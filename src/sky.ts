// from https://github.com/Sean-Bradley/three.js/blob/gerstner-waves/examples/webgl_shaders_ocean_gerstner.html

import { Vector3 } from 'three';
import { Sky } from 'three/examples/jsm/objects/sky';

export class Atmosphere {
    private _sky: Sky

    public constructor() {
        this._sky = new Sky();
        this._sky.scale.setScalar(1000);

        const skyUniforms = this._sky.material.uniforms;

        skyUniforms.turbidity.value = 5.7;
        skyUniforms.rayleigh.value = 2.116;
        skyUniforms.mieCoefficient.value = 0.001;
        skyUniforms.mieDirectionalG.value = 0.67;
    }

    public set sun(value: Vector3) {
        this._sky.material.uniforms.sunPosition.value.copy(value);
    }

    public get sky(): Sky {
        return this._sky;
    }
}
