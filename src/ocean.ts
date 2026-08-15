// from https://github.com/Sean-Bradley/three.js/blob/gerstner-waves/examples/webgl_shaders_ocean_gerstner.html

import { Vector3, PlaneGeometry, TextureLoader, RepeatWrapping, Vector2 } from 'three';
import { Water } from 'three/examples/jsm/objects/water';

export class Ocean {
    private _water: Water

    private _waves = [
        { direction: 0, steepness: 0.2, wavelength: 60 },
        { direction: 30, steepness: 0.2, wavelength: 30 },
        { direction: 60, steepness: 0.2, wavelength: 15 },
    ];

    public constructor() {
        const waterGeometry = new PlaneGeometry(2048, 2048, 512, 512);

        this._water = new Water(waterGeometry, {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: new TextureLoader().load(
                'textures/waternormals.jpg',
                function (texture) {
                    texture.wrapS = texture.wrapT = RepeatWrapping;
                }
            ),
            sunDirection: new Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x001e0f,
            distortionScale: 3.7,
            fog: false,
        });
        this._water.rotation.x = - Math.PI / 2;

        this._water.material.onBeforeCompile = (shader) => {
            const [waveA, waveB, waveC] = this._waves;
            shader.uniforms.waveA = {
                value: [
                    Math.sin((waveA.direction * Math.PI) / 180),
                    Math.cos((waveA.direction * Math.PI) / 180),
                    waveA.steepness,
                    waveA.wavelength,
                ],
            };
            shader.uniforms.waveB = {
                value: [
                    Math.sin((waveB.direction * Math.PI) / 180),
                    Math.cos((waveB.direction * Math.PI) / 180),
                    waveB.steepness,
                    waveB.wavelength,
                ],
            };
            shader.uniforms.waveC = {
                value: [
                    Math.sin((waveC.direction * Math.PI) / 180),
                    Math.cos((waveC.direction * Math.PI) / 180),
                    waveC.steepness,
                    waveC.wavelength,
                ],
            };

            shader.vertexShader =  /* glsl */ `
            uniform mat4 textureMatrix;
            uniform float time;

            varying vec4 mirrorCoord;
            varying vec4 worldPosition;

            #include <common>
            #include <fog_pars_vertex>
            #include <shadowmap_pars_vertex>
            #include <logdepthbuf_pars_vertex>

            uniform vec4 waveA;
            uniform vec4 waveB;
            uniform vec4 waveC;

            vec3 GerstnerWave (vec4 wave, vec3 p) {
            	float steepness = wave.z;
            	float wavelength = wave.w;
            	float k = 2.0 * PI / wavelength;
            	float c = sqrt(9.8 / k);
            	vec2 d = normalize(wave.xy);
            	float f = k * (dot(d, p.xy) - c * time);
            	float a = steepness / k;

            	return vec3(
            		d.x * (a * cos(f)),
            		d.y * (a * cos(f)),
            		a * sin(f)
            	);
            }

            void main() {
            	mirrorCoord = modelMatrix * vec4( position, 1.0 );
            	worldPosition = mirrorCoord.xyzw;
            	mirrorCoord = textureMatrix * mirrorCoord;

            	vec3 p = position.xyz;
            	p += GerstnerWave(waveA, position.xyz);
            	p += GerstnerWave(waveB, position.xyz);
            	p += GerstnerWave(waveC, position.xyz);
            	gl_Position = projectionMatrix * modelViewMatrix * vec4( p.x, p.y, p.z, 1.0);

            	#include <beginnormal_vertex>
            	#include <defaultnormal_vertex>
            	#include <logdepthbuf_vertex>
            	#include <fog_vertex>
            	#include <shadowmap_vertex>
            }
            `

            shader.fragmentShader = /* glsl */  `
                  uniform sampler2D mirrorSampler;
            uniform float alpha;
            uniform float time;
            uniform float size;
            uniform float distortionScale;
            uniform sampler2D normalSampler;
            uniform vec3 sunColor;
            uniform vec3 sunDirection;
            uniform vec3 eye;
            uniform vec3 waterColor;

            varying vec4 mirrorCoord;
            varying vec4 worldPosition;

            vec4 getNoise( vec2 uv ) {
                vec2 uv0 = ( uv / 103.0 ) + vec2(time / 17.0, time / 29.0);
                vec2 uv1 = uv / 107.0-vec2( time / -19.0, time / 31.0 );
                vec2 uv2 = uv / vec2( 8907.0, 9803.0 ) + vec2( time / 101.0, time / 97.0 );
                vec2 uv3 = uv / vec2( 1091.0, 1027.0 ) - vec2( time / 109.0, time / -113.0 );
                vec4 noise = texture2D( normalSampler, uv0 ) +
                    texture2D( normalSampler, uv1 ) +
                    texture2D( normalSampler, uv2 ) +
                    texture2D( normalSampler, uv3 );
                return noise * 0.5 - 1.0;
            }

            void sunLight( const vec3 surfaceNormal, const vec3 eyeDirection, float shiny, float spec, float diffuse, inout vec3 diffuseColor, inout vec3 specularColor ) {
                vec3 reflection = normalize( reflect( -sunDirection, surfaceNormal ) );
                float direction = max( 0.0, dot( eyeDirection, reflection ) );
                specularColor += pow( direction, shiny ) * sunColor * spec;
                diffuseColor += max( dot( sunDirection, surfaceNormal ), 0.0 ) * sunColor * diffuse;
            }

            #include <common>
            #include <packing>
            #include <bsdfs>
            #include <fog_pars_fragment>
            #include <logdepthbuf_pars_fragment>
            #include <lights_pars_begin>
            #include <shadowmap_pars_fragment>
            #include <shadowmask_pars_fragment>

            void main() {

                #include <logdepthbuf_fragment>
                vec4 noise = getNoise( worldPosition.xz * size );
                vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );

                vec3 diffuseLight = vec3(0.0);
                vec3 specularLight = vec3(0.0);

                vec3 worldToEye = eye-worldPosition.xyz;
                vec3 eyeDirection = normalize( worldToEye );
                sunLight( surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight );

                float distance = length(worldToEye);

                vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale;
                vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) );

                float theta = max( dot( eyeDirection, surfaceNormal ), 0.0 );
                float rf0 = 0.3;
                float reflectance = rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 );
                vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;
                vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask(), ( vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight ), reflectance);
                vec3 outgoingLight = albedo;
                gl_FragColor = vec4( outgoingLight, alpha );

                #include <tonemapping_fragment>
                #include <fog_fragment>
            }
            `
        };
    }

    public getWaveInfo(x: number, z: number, time: number) {

        const pos = new Vector3();
        const tangent = new Vector3(1, 0, 0);
        const binormal = new Vector3(0, 0, 1);
        this._waves.forEach((wave) => {

            const k = (Math.PI * 2) / wave.wavelength;
            const c = Math.sqrt(9.8 / k);
            const d = new Vector2(
                Math.sin((wave.direction * Math.PI) / 180),
                - Math.cos((wave.direction * Math.PI) / 180)
            );
            const f = k * (d.dot(new Vector2(x, z)) - c * time);
            const a = wave.steepness / k;

            pos.x += d.y * (a * Math.cos(f));
            pos.y += a * Math.sin(f);
            pos.z += d.x * (a * Math.cos(f));

            tangent.x += - d.x * d.x * (wave.steepness * Math.sin(f));
            tangent.y += d.x * (wave.steepness * Math.cos(f));
            tangent.z += - d.x * d.y * (wave.steepness * Math.sin(f));

            binormal.x += - d.x * d.y * (wave.steepness * Math.sin(f));
            binormal.y += d.y * (wave.steepness * Math.cos(f));
            binormal.z += - d.y * d.y * (wave.steepness * Math.sin(f));

        });

        const normal = binormal.cross(tangent).normalize();

        return { position: pos, normal: normal };

    }

    public update(delta: number) {
        this._water.material.uniforms.time.value += delta;
    }

    public set sun(value: Vector3) {
        this._water.material.uniforms.sunDirection.value.copy(value).normalize();
    }

    public get water(): Water {
        return this._water;
    }

    public get time() {
        return this._water.material.uniforms.time.value;
    }
}
