import {
    AdditiveBlending, Box3, BufferGeometry, Group, Line, LineBasicMaterial, Matrix4,
    Mesh, Points, Quaternion, ShaderMaterial, Vector3,
} from 'three';
import { TRANSITION_DURATION } from './config';
import { random } from './utils';

export class Actor extends Group {
    private _switching = false;
    private _transitionStart = 0;
    private _rayGroup: Group = new Group();
    private _speed = 5;
    private _bbox = new Box3();
    private _scan = 0;

    public constructor(private _points: Points, private _meshes: Group) {
        super();
        this.add(this._points);
        this.add(this._meshes);

        this._bbox.setFromObject(this._meshes);

        const mat = this._points.material as ShaderMaterial;
        mat.uniforms.uShow.value = 1.0;
        this._meshes.traverse(mesh => {
            if (mesh instanceof Mesh) {
                const userData = mesh.material.userData;
                userData.customUniforms.uShow.value = 1;
            }
        });
    }

    public applyMatrix(matrix: Matrix4) {
        // this.applyMatrix4(matrix);
        this._meshes.applyMatrix4(matrix);
        this._points.applyMatrix4(matrix);
        this._points.updateMatrixWorld();
    }

    public startTransition() {
        this._transitionStart = performance.now();
        this._switching = true;
    }

    public destroy() {
        this.startTransition();
        const mat = this._points.material as ShaderMaterial;
        mat.uniforms.uShow.value = 0.0;
        this._meshes.traverse(mesh => {
            if (mesh instanceof Mesh) {
                const userData = mesh.material.userData;
                userData.customUniforms.uShow.value = 0;
            }
        });

        this._points.geometry.dispose();
    }

    public update(delta: number, timestamp: number, waveInfo: { position: Vector3, normal: Vector3 }) {
        const { position, normal } = waveInfo;
        const { y } = position;
        const offsetY = y - this._meshes.position.y;
        this.position.y = offsetY;

        const up = normal.clone().normalize();

        const forward = new Vector3();
        this._meshes.getWorldDirection(forward);

        const right = new Vector3().crossVectors(up, forward).normalize();

        const newForward = new Vector3().crossVectors(right, up).normalize();

        const m = new Matrix4();
        m.set(
            right.x, up.x, newForward.x, 0,
            right.y, up.y, newForward.y, 0,
            right.z, up.z, newForward.z, 0,
            0, 0, 0, 1
        );
        const quat = new Quaternion().setFromRotationMatrix(m);

        this._meshes.quaternion.rotateTowards(quat, delta * 0.5);
        this._points.quaternion.copy(this._meshes.quaternion);
        this.translateZ(-delta * this._speed);

        this._bbox.setFromObject(this._meshes);

        this._updateMaterial();
        this._updateTransition(timestamp);
        this._updateRays(delta);
    }

    public get meshes() {
        return this._meshes;
    }

    public get points() {
        return this._points;
    }

    public get rayGroup() {
        return this._rayGroup;
    }

    public get height() {
        return this._bbox.max.y - this._bbox.min.y;
    }

    public get bottom() {
        return this._bbox.min.y || 0;
    }

    public get worldPos() {
        const pos = new Vector3();
        this._meshes.getWorldPosition(pos);
        return pos;
    }

    public set switching(value: boolean) {
        this._switching = value;
    }

    private _updateMaterial() {
        const mat = this._points.material as ShaderMaterial;
        const scale = 1.1;
        mat.uniforms.uRangeY.value = this.height * scale;
        mat.uniforms.uBottom.value = this.bottom;

        this._meshes.traverse(mesh => {
            if (mesh instanceof Mesh) {
                const userData = mesh.material.userData;
                userData.customUniforms.uRangeY.value = this.height * scale;
                userData.customUniforms.uBottom.value = this.bottom;
            }
        });
    }

    private _pickRayTargetIndex(scanY: number, range: number) {
        const vertices = this._points.geometry.attributes.position.array;
        for (let tries = 0; tries < 48; tries++) {
            const idx = Math.floor(Math.random() * (vertices.length / 3));
            const worldPos = new Vector3(vertices[idx * 3], vertices[idx * 3 + 1], vertices[idx * 3 + 2]).applyMatrix4(this._points.matrixWorld);
            if (Math.abs(worldPos.y - scanY) < range / 100) return worldPos;
        }
        return null;
    }

    private _spawnRays(total: number, scanY: number) {
        const { max, min } = this._bbox;
        const rangeX = max.x - min.x;
        const rangeY = max.y - min.y;
        const rangeZ = max.z - min.z;
        for (let i = 0; i < total; i++) {
            const worldPos = this._pickRayTargetIndex(scanY, rangeY);
            if (!worldPos) continue;
            const src = new Vector3(worldPos.x + random(-rangeX, rangeX) * 2, max.y * 10, worldPos.z + random(-rangeZ, rangeZ) * 2);
            const geo = new BufferGeometry().setFromPoints([src, worldPos]);
            const mat = new LineBasicMaterial({
                color: 0x88aaff,
                transparent: true,
                opacity: 0.34,
                depthTest: false,
                depthWrite: false,
                toneMapped: false,
                blending: AdditiveBlending,
            });
            const line = new Line(geo, mat);
            line.userData.life = random(0.18, 0.56);
            line.userData.maxLife = line.userData.life;
            this._rayGroup.add(line);
        }
    }

    private _updateRays(delta: number) {
        for (let i = this._rayGroup.children.length - 1; i >= 0; i--) {
            const ray = this._rayGroup.children[i];
            if (!(ray instanceof Line)) {
                console.warn('raygroup member is not a line');
                continue;
            }
            ray.userData.life -= delta;
            ray.material.opacity = Math.max(0, ray.userData.life / ray.userData.maxLife) * 0.38;
            if (this._scan > 0.8) {
                ray.material.opacity -= 0.2 * this._scan;
            }
            ray.geometry.attributes.position.array[4] += delta * this.height;
            ray.geometry.attributes.position.needsUpdate = true;
            if (ray.userData.life <= 0) {
                ray.geometry.dispose();
                ray.material.dispose();
                this._rayGroup.remove(ray);
            }
        }
    }

    private _updateTransition(now: number) {
        if (!this._switching) return;
        const { max, min } = this._bbox;
        const progress = Math.min(1, (now - this._transitionStart) / TRANSITION_DURATION);
        this._scan = progress * 1.18 - 0.08;
        const scanY = min.y + this._scan * (max.y - min.y);
        const mat = this._points.material as ShaderMaterial;
        mat.uniforms.uReveal.value = this._scan;
        mat.uniforms.uScan.value = this._scan;
        this._meshes.traverse(mesh => {
            if (mesh instanceof Mesh) {
                const userData = mesh.material.userData;
                const offset = userData.customUniforms.uShow.value === 0 ? 0 : -0.05;
                userData.customUniforms.uReveal.value = this._scan + offset;
                userData.customUniforms.uScan.value = this._scan + offset;
            }
        });

        if (Math.random() < 0.42) {
            this._spawnRays(4, scanY);
        }
        if (progress >= 1) {
            this._switching = false;
            mat.uniforms.uReveal.value = 1;
            mat.uniforms.uScan.value = 1;
            this._meshes.traverse(mesh => {
                if (mesh instanceof Mesh) {
                    const userData = mesh.material.userData;
                    userData.customUniforms.uReveal.value = 1;
                    userData.customUniforms.uScan.value = 1;
                }
            });
        }
    }
}
