#version 300 es
        precision highp float;

        uniform vec3 iResolution;
        uniform float iTime;
        uniform vec4 iMouse;
        uniform sampler2D iChannel0;
        uniform vec3 iChannelResolution[1];

        out vec4 fragColor;

        vec4 zoomBlur(sampler2D tex, vec2 uv, vec2 resolution, vec2 center, float strength, int samples) {
            vec4 color = vec4(0.0);
            vec2 direction = uv - center;
            float total = 0.0;

            for (int i = 0; i < samples; i++) {
                float t = float(i) / float(samples - 1);
                vec2 offset = direction * t * strength / resolution;
                color += texture(tex, uv + offset);
                total += 1.0;
            }

            color /= total;
            return color;
        }

        #define HASHSCALE3 vec3(.1031, .0973, .0973)
        #define UVSCALE 100.

        vec2 hash2d(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * HASHSCALE3);
            p3 += dot(p3, p3.yzx + 19.19);
            return fract((p3.xx + p3.yz) * p3.zy);
        }

        void mainImage(out vec4 fragColor, in vec2 fragCoord) {
            vec2 uv = vec2(fragCoord.xy / iResolution.xy);

            vec4 zoom1 = zoomBlur(iChannel0, uv, iChannelResolution[0].xy, vec2(0.5, 1.9), 40., 20); // blue
            vec4 zoom2 = zoomBlur(iChannel0, vec2(uv.x, uv.y), iChannelResolution[0].xy, vec2(0.5, 2.0), 60., 30); // purple
            vec4 zoom3 = zoomBlur(iChannel0, vec2(uv.x, uv.y - 0.03), iChannelResolution[0].xy, vec2(0.5, 2.0), 30., 30); // red

            vec3 colorizeBuffer_1 = mix(vec3(0.765, 0.965, 0.035), zoom1.rgb, 1.9);
            colorizeBuffer_1 = smoothstep(0.0, 1.4, colorizeBuffer_1 * 0.4);
            colorizeBuffer_1 = mix(colorizeBuffer_1, vec3(0.639, 0.675, 0.941), colorizeBuffer_1);

            vec3 colorizeBuffer_2 = mix(vec3(0.020, 1.000, 0.133), zoom2.rgb, 1.3);
            colorizeBuffer_2 = smoothstep(0.0, 1.2, colorizeBuffer_2 * 0.5);
            colorizeBuffer_2 = mix(colorizeBuffer_2, vec3(0.851, 0.188, 0.643), colorizeBuffer_2);

            vec3 colorizeBuffer_3 = mix(vec3(0.020, 1.000, 0.133), zoom3.rgb, 1.3);
            colorizeBuffer_3 = smoothstep(0.0, 1.2, colorizeBuffer_3 * 0.3);
            colorizeBuffer_3 = mix(colorizeBuffer_3, vec3(1.000, 0.000, 0.000), colorizeBuffer_3);

            vec3 finalColor = colorizeBuffer_1 + colorizeBuffer_2 + colorizeBuffer_3;

            vec3 col = vec3(0.0);

            for (int i = 0; i < 8; i++) {
                vec2 mouseCoords = vec2(1.0, 1.0);
                if (iMouse.z > 0.0) {
                    mouseCoords = iMouse.xy / iResolution.xy;
                }

                float screenRatio = iResolution.x / iResolution.y;
                vec2 ratioScale = vec2(1.0 * screenRatio, 1.0);
                vec2 uvScale = vec2(float(i) * 1.0 + UVSCALE);
                vec2 cellUv = (fragCoord * ratioScale / iResolution.xy) * uvScale;

                vec2 CellUVs = floor(cellUv + float(i * 1199));
                vec2 hash = (hash2d(CellUVs) * 2.0 - 1.0) * mouseCoords.x * 2.0;
                float hash_magnitude = (1.0 - length(hash));

                vec2 UVgrid = fract(cellUv) - 0.5;

                float radius = clamp(hash_magnitude - 0.5, 0.0, 1.0);
                float radialGradient = length(UVgrid - hash) / radius;
                radialGradient = clamp(1.0 - radialGradient, 0.0, 1.0);
                radialGradient *= radialGradient;

                col += vec3(radialGradient);
            }
            col = mix(vec3(0.227, 0.373, 0.714), col, uv.y / 3.0 + 0.4);
            col = mix(vec3(0.0), col, uv.y + 0.2);

            fragColor = vec4(col + finalColor, 1.0);
            fragColor = tanh(fragColor);
        }

        void main() {
            mainImage(fragColor, gl_FragCoord.xy);
        }