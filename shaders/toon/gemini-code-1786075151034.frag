#version 300 es
        /* Creative Commons Licence Attribution-NonCommercial-ShareAlike 
        phreax/jiagual 2025 

        Based on https://www.shadertoy.com/view/3XjXzK
        Inspired by Xor's recent volumetric shaders https://www.shadertoy.com/view/tXlXDX
        */

        precision highp float;

        uniform vec3 iResolution;
        uniform float iTime;
        uniform vec4 iMouse;
        
        out vec4 fragColor;

        #define SIN(x) sin(x)

        mat2 rot(float x) { 
            return mat2(cos(x), -sin(x), sin(x), cos(x)); 
        }

        vec3 pal(float x) { 
            return 0.5 + 0.5 * cos(6.28318530718 * x - vec3(5.0, 0.0, 2.0)); 
        }

        vec3 getPal(int id, float k) {
            return pal(k);
        }

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        vec3 rotate3D(vec3 p, vec2 angle) {
            mat2 rx = rot(angle.y);
            p.yz = rx * p.yz;
            mat2 ry = rot(angle.x);
            p.xz = ry * p.xz;
            return p;
        }

        void main() {
            vec2 fragCoord = gl_FragCoord.xy;
            vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
            float tt = iTime * 0.5;
            
            uv.xy *= mix(0.8, 1.2, SIN(-tt + 5.0 * length(uv.xy)));
            
            vec3 col = vec3(0.0);

            // Interactive camera orientation derived from iMouse dragging
            vec2 camAngle = vec2(0.0);
            if (iMouse.z > 0.0 || iMouse.x != 0.0) {
                camAngle = (iMouse.xy - 0.5 * iResolution.xy) / iResolution.y * 2.0;
            }

            vec3 rd = normalize(vec3(uv, 1.0));
            rd = rotate3D(rd, camAngle);

            float t = 0.1 * hash(fragCoord);

            for(float i = 0.0; i < 120.0; i++) {
                vec3 p = t * rd + rd;
                p.z += tt;

                float z = p.z;
                p.xy *= rot(p.z);

                for(float j = 0.0; j < 3.0; j++) {     
                    float a = exp(j) / exp2(j);
                    p += cos(3.0 * p.yzx * a + 0.5 * tt - length(p.xy) * 9.0) / a; 
                }

                float d = 0.007 + abs((exp2(1.3 * p) - vec3(0.0, 1.0 + 0.7 * SIN(tt), 0.0)).y - 1.0) / 14.0;
                float k = t * 0.7 + length(p) * 0.1 - 0.2 * tt + z * 0.1;
                
                vec3 c = getPal(7, k);
                c = mix(c, c * vec3(0.922, 0.973, 0.725), SIN(z * 0.5));
                col += c * 1e-3 / d;       
                t += d / 4.0;
            }
            
            float gl = exp(-20.0 * length(uv.xy));
            col += 0.4 * mix(vec3(0.361, 0.957, 1.000), vec3(0.847, 1.000, 0.561), SIN(gl * 2.0 - tt)) * pow(gl * 11.0, 1.0);
            
            col *= tanh(col * 0.1);
            col = pow(col, vec3(0.45));
            
            fragColor = vec4(col, 1.0);
        }