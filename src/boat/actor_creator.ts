import {
    Vector3, Color, BufferGeometry, BufferAttribute, Points, Mesh, CanvasTexture,
    AdditiveBlending, ShaderMaterial, Group, Matrix4, MeshStandardMaterial, Box3
} from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Actor } from './actor';
import { PointGenerator, Triangle } from './point_generator';

const loader = new GLTFLoader();

const cachedActor = new Map<string, Actor>();

const pointGenerator = new PointGenerator();

export class ActorCreator {
    private _particleTexture: CanvasTexture;

    public constructor() {
        this._particleTexture = this._makeParticleSprite()!;
    }

    public async createActor(url: string) {
        let actor: Actor;

        if (cachedActor.has(url)) {
            actor = cachedActor.get(url)!;
        } else {
            const gltf = await loader.loadAsync(url);
            const { vertices, meshes } = this._sampleTrianglesByArea(gltf);

            const box = new Box3().setFromObject(meshes);
            const size = new Vector3();
            box.getSize(size);
            const maxSize = Math.max(size.x, size.y, size.z);
            const center = new Vector3();
            box.getCenter(center);
            const scale = 40 / Math.max(1, maxSize);

            for (const p of vertices) {
                p.x = (p.x - center.x) * scale;
                p.y = (p.y - center.y) * scale;
                p.z = (p.z - center.z) * scale;
            }

            meshes.applyMatrix4(new Matrix4().multiply(new Matrix4().makeScale(scale, scale, scale)).multiply(new Matrix4().makeTranslation(-center.x, -center.y, -center.z)));

            const positions = new Float32Array(vertices.length * 3);

            for (let i = 0; i < vertices.length; i++) {
                positions[i * 3] = vertices[i].x;
                positions[i * 3 + 1] = vertices[i].y;
                positions[i * 3 + 2] = vertices[i].z;
            }

            const material = new ShaderMaterial({
                uniforms: {
                    uTexture: { value: this._particleTexture },
                    uPointSize: { value: 256 * window.devicePixelRatio },
                    uColor: { value: new Color(0x88aaff) },
                    uScan: { value: 0 },
                    uReveal: { value: 1 },
                    uShow: { value: 1 },
                    uRangeY: { value: 1 },
                    uBottom: { value: 0 },
                },
                vertexShader: /* glsl */ `
            attribute float alpha;
            uniform float uPointSize;
            uniform float uRangeY;
            uniform float uScan;
            uniform float uReveal;
            uniform float uShow;
            uniform float uBottom;
            varying float vScan;
            varying float vAlpha;

            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                float worldY = clamp((worldPosition.y - uBottom) / uRangeY, 0.0, 1.0);

                vec4 mvPosition = viewMatrix * worldPosition;
                gl_PointSize = uPointSize * (1.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;

                float scanGlow = 1.0 - smoothstep(0.0, 0.02, abs(worldY - uScan));
                float revealAlpha = 1.0 - smoothstep(uReveal, uReveal + 0.075, worldY);

                vScan = scanGlow;
                vAlpha = revealAlpha;
            }
        `,
                fragmentShader: /* glsl */ `
            uniform sampler2D uTexture;
            uniform vec3 uColor;
            varying float vAlpha;
            varying float vScan;

            void main() {
                vec4 tex = texture2D(uTexture, gl_PointCoord);
                float alpha = tex.a * vAlpha * (vScan * 1.4);
                gl_FragColor = vec4(uColor, alpha);
            }
        `,
                transparent: true,
                blending: AdditiveBlending,
                depthTest: false,
                depthWrite: false,
            })

            const geometry = new BufferGeometry();
            geometry.setAttribute('position', new BufferAttribute(positions, 3));

            const points = new Points(geometry, material);
            actor = new Actor(points, meshes);
            cachedActor.set(url, actor);
        }
        return this._cloneActor(actor);

    }

    private _setupBoatMaterial(material: MeshStandardMaterial) {
        const customUniforms = {
            uColor: { value: new Color(0x88aaff) },
            uScan: { value: 0 },
            uReveal: { value: 1 },
            uShow: { value: 1 },
            uRangeY: { value: 1 },
            uBottom: { value: 0 },
        };

        material.userData.customUniforms = customUniforms;
        material.transparent = true;
        material.onBeforeCompile = (shader) => {
            shader.uniforms.uScan = customUniforms.uScan;
            shader.uniforms.uReveal = customUniforms.uReveal;
            shader.uniforms.uShow = customUniforms.uShow;
            shader.uniforms.uRangeY = customUniforms.uRangeY;
            shader.uniforms.uColor = customUniforms.uColor;
            shader.uniforms.uBottom = customUniforms.uBottom;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
        /* glsl */  `#include <common>
                varying vec4 vWorldPosition;
                `
            );

            shader.vertexShader = shader.vertexShader.replace(
                '#include <project_vertex>',
        /* glsl */  `#include <project_vertex>
                vWorldPosition = modelMatrix * vec4(position, 1.0);
            `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
        /* glsl */  `#include <common>
                uniform float uScan;
                uniform float uReveal;
                uniform float uShow;
                uniform float uRangeY;
                uniform float uBottom;
                uniform vec3 uColor;
                varying vec4 vWorldPosition;
                `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <opaque_fragment>',
        /* glsl */  `#include <opaque_fragment>
                float worldY = clamp((vWorldPosition.y - uBottom) / uRangeY, 0.0, 1.0);
                float scanGlow = 1.0 - smoothstep(0.0, 0.05, abs(worldY - uScan));
                float revealAlpha = 1.0 - smoothstep(uReveal, uReveal + 0.075, worldY);
                if (uShow == 0.0) {
                    revealAlpha = 1.0 - revealAlpha;
                }
                float finalAlpha = diffuseColor.a * revealAlpha * (1.0 + scanGlow * 1.4);
                // vec3 baseColor = gl_FragColor.rgb;
                // vec3 finalColor = mix(baseColor, uColor, scanGlow * 0.9);
                gl_FragColor.a = finalAlpha;
                `
            );
        }
        return material;
    }

    private _cloneActor(actor: Actor) {
        const { points: pointsTemplate, meshes: meshesTemplate } = actor;
        const points = new Points(pointsTemplate.geometry.clone(), (pointsTemplate.material as ShaderMaterial).clone());
        const meshes = meshesTemplate.clone(true);
        meshes.traverse((mesh) => {
            if (!(mesh instanceof Mesh)) return;
            mesh.material = this._setupBoatMaterial(mesh.material.clone());
        });
        return new Actor(points, meshes);
    }

    private _makeParticleSprite() {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d');
        if (!ctx) return null;
        const s = 64 * 10;
        c.width = s;
        c.height = s;
        const center = s / 2;
        const radius = s / 2;
        const g = ctx.createRadialGradient(center, center, 0, center, center, radius);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.24, 'rgba(255,255,255,.9)');
        g.addColorStop(0.72, 'rgba(255,255,255,.18)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
        const tex = new CanvasTexture(c);
        tex.needsUpdate = true;
        return tex;
    }

    private _sampleTrianglesByArea(gltf: GLTF, targetCount = 45000) {
        const meshes: { child: Mesh, triangles: Triangle[], totalArea: number, vertexCount: number }[] = [];

        const group = new Group();

        gltf.scene.traverse((child) => {
            if (!(child instanceof Mesh)) return;

            const pos = child.geometry.getAttribute('position');
            const index = child.geometry.getIndex();
            if (!pos) {
                console.warn('no pos');
                return;
            }

            child.updateWorldMatrix(true, false);

            let totalArea = 0;
            const triangles: Triangle[] = [];

            if (index) {
                for (let i = 0; i < index.count; i += 3) {
                    const i0 = index.getX(i);
                    const i1 = index.getX(i + 1);
                    const i2 = index.getX(i + 2);

                    const v0 = new Vector3().fromBufferAttribute(pos, i0).applyMatrix4(child.matrixWorld);
                    const v1 = new Vector3().fromBufferAttribute(pos, i1).applyMatrix4(child.matrixWorld);
                    const v2 = new Vector3().fromBufferAttribute(pos, i2).applyMatrix4(child.matrixWorld);

                    const a = v0.clone().sub(v1);
                    const b = v0.clone().sub(v2);
                    const area = a.cross(b).length() / 2;
                    totalArea += area;

                    triangles.push({ v0, v1, v2, area });
                }
            }

            meshes.push({
                child,
                triangles,
                totalArea,
                vertexCount: pos.count
            })

            const mesh = child.clone();
            mesh.geometry.applyMatrix4(child.matrixWorld);
            mesh.material = this._setupBoatMaterial(mesh.material);
            group.add(mesh);
        })

        const grandTotalArea = meshes.reduce((sum, m) => sum + m.totalArea, 0);
        if (grandTotalArea === 0) {
            console.warn('no area found');
            return { vertices: [], meshes: group };
        }

        const allPoints = []
        let remainingCount = targetCount;

        for (const mesh of meshes) {
            let meshCount = Math.floor((mesh.totalArea / grandTotalArea) * targetCount);
            meshCount = Math.max(meshCount, Math.min(100, Math.floor(targetCount * 0.01)));

            const points = pointGenerator.sampleMeshTrianglesYUniformSimple(mesh.triangles, meshCount);
            allPoints.push(...points);
            remainingCount -= points.length;
        }

        if (remainingCount > 0 && meshes.length > 0) {
            const largest = meshes.reduce((a, b) => a.totalArea > b.totalArea ? a : b);
            const extra = pointGenerator.sampleMeshTrianglesYUniformSimple(largest.triangles, remainingCount);
            allPoints.push(...extra);
        }

        return { vertices: allPoints, meshes: group };
    }

}
