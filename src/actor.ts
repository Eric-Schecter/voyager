import {
    BufferGeometry, Group, Line, LineBasicMaterial, MathUtils, Matrix4, Mesh, Points, ShaderMaterial, Vector3,
} from 'three';
import { TRANSITION_DURATION } from './config';
import { random } from './utils';

export class Actor {
    private _switching = false;
    private _transitionStart = 0;
    private _rayGroup: Group = new Group();

    public constructor(private _points: Points, private _meshes: Group) {
        this._transitionStart = performance.now();
        const bbox = this._points.geometry.boundingBox;
        this._spawnRays(96, bbox?.min?.y || 0);
        this._switching = true;

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
        this._meshes.applyMatrix4(matrix);
        this._points.applyMatrix4(matrix);
        this._rayGroup.applyMatrix4(matrix);
    }

    public destroy() {
        this.switching = true;
        this.transitionStart = performance.now();
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

    public update(delta: number, timestamp: number) {
        this._updateTransition(timestamp);
        this._updateRays(delta);

        // this._rayGroup.translateX(delta);
        // this.points.translateX(delta);
        // this.meshes.translateX(delta);
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

    public set switching(value: boolean) {
        this._switching = value;
    }

    public set transitionStart(value: number) {
        this._transitionStart = value;
    }

    private _pickRayTargetIndex(scanY: number, range: number) {
        const vertices = this._points.geometry.attributes.position.array;
        for (let tries = 0; tries < 48; tries++) {
            const idx = Math.floor(Math.random() * vertices.length / 3);
            if (Math.abs(vertices[idx * 3 + 1] - scanY) < range / 100) return idx;
        }
        return -1;
    }

    private _spawnRays(total: number, scanY: number) {
        const bbox = this._points.geometry.boundingBox;
        if (!bbox) {
            console.warn('points geometry has no bounding box');
            return;
        }
        const { max, min } = bbox;
        const rangeX = max.x - min.x;
        const rangeY = max.y - min.y;
        const rangeZ = max.z - min.z;
        const vertices = this._points.geometry.attributes.position.array;
        for (let i = 0; i < total; i++) {
            const ti = this._pickRayTargetIndex(scanY, rangeY);
            if (ti < 0) continue;
            const t = vertices.slice(ti * 3, ti * 3 + 3);
            const src = new Vector3(t[0] + random(-rangeX, rangeX) * 2, max.y * 10, t[2] + random(-rangeZ, rangeZ) * 2);
            const geo = new BufferGeometry().setFromPoints([src, new Vector3(t[0], t[1], t[2])]);
            const mat = new LineBasicMaterial({
                color: 0x88aaff,
                transparent: true,
                opacity: 0.34,
                depthTest: false,
                depthWrite: false,
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
            if (ray.userData.life <= 0) {
                ray.geometry.dispose();
                ray.material.dispose();
                this._rayGroup.remove(ray);
            }
        }
    }

    private _updateTransition(now: number) {
        if (!this._switching) return;
        const bbox = this._points.geometry.boundingBox;
        if (!bbox) {
            console.warn('points geometry has no bounding box');
            return;
        }
        const { max, min } = bbox;
        const progress = Math.min(1, (now - this._transitionStart) / TRANSITION_DURATION);
        const scan = MathUtils.clamp(progress * 1.18 - 0.08, 0, 1);
        const mat = this._points.material as ShaderMaterial;
        mat.uniforms.uReveal.value = scan;
        mat.uniforms.uScan.value = scan;
        this._meshes.traverse(mesh => {
            if (mesh instanceof Mesh) {
                const userData = mesh.material.userData;
                const offset = userData.customUniforms.uShow.value === 0 ? 0 : -0.05;
                userData.customUniforms.uReveal.value = scan + offset;
                userData.customUniforms.uScan.value = scan + offset;
            }
        });

        if (Math.random() < 0.42) {
            this._spawnRays(4, min.y + scan * (max.y - min.y));
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
