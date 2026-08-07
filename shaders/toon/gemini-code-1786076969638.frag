#version 300 es
        precision highp float;

        uniform vec3 iResolution;
        uniform float iTime;
        out vec4 fragColor;

        // Sunset over the ocean.
        // Minimalistic three color 2D shader
        // inspired by this wonderful GIF: https://i.gifer.com/4Cb2.gif
        //
        // Features automatic anti aliasing by using smooth gradients
        // removing the need for multi sampling.
        //
        // Revision 1:
        //  - Add qnoise as approximation to value noise
        //  - Inline remap() macro
        //  - Beware of the Shark! (idea by FabriceNeyret2)
        //
        // Copyright (c) srvstr 2025
        // Licensed under MIT
        //

        /* Simple cosine based approximation of perlin noise.
         * Gives a more organic appearance.
         */
        float cnoise(in vec2 uv)
        {
            // Rotation matrix with values corresponding to sin(1.7) and cos(1.7).
            const mat2 r = mat2(-0.1288, -0.9917, 0.9917, -0.1288);

            vec2 s0 = cos(uv);
            vec2 s1 = cos(uv * 2.5 * r);
            vec2 s2 = cos(uv * 4.0 * r * r);

            vec2 s = s0 * s1 * s2;

            return (s.x + s.y) * 0.25 + 0.5;
        }

        #define S(x) (smoothstep(0.0, 1.0, (x)))

        /* BW Mask of shark's fin.
         */
        float fin(in vec2 uv)
        {
            uv.x += S(S(S(abs(1.0 - 2.0 * fract(iTime * 0.02))))) - 0.5;
            
            uv *= vec2(sign(abs(1.0 - 2.0 * fract(iTime * 0.02 + 0.25)) - 0.5), 1) * 3.5;

            float d = smoothstep(1.5/iResolution.y, 0.0,
                                 uv.y
                                 + 2.0 * uv.x * uv.x
                                 + max(0.0, -(uv.y + 0.3) * (uv.y + 0.3) + uv.x * 3.0) * 5.0);

            return 1.0 - d * smoothstep(-0.4, -0.4+3.0/iResolution.y,
                                        uv.y + sin(iTime * 4.0 - uv.x * 16.0) / 100.0);
        }

        void mainImage(out vec4 fragColor, in vec2 fragCoord)
        {
            vec2 uv = (fragCoord - 0.5 * iResolution.xy)
                        / iResolution.y;

            // Bias for smoothstep function to simulate anti aliasing
            // with gradients.
            float dy = (smoothstep(0.0, -1.0, uv.y) * 40.0 + 1.5)
                        / iResolution.y;

            // Wave displacement factors.
            // XY: scale the UV coordinates for the noise.
            // Z: scales the noises strength.
            vec3[] disp = vec3[](
                vec3(vec2( 0.5, 20.0), 8.0),
                vec3(vec2( 2.5, 60.0), 4.0),
                vec3(vec2( 5.0, 80.0), 2.0),
                vec3(vec2(10.0, 20.0), 2.0));

            float avg = 0.0;
            // Compute average of noise displacements
            for (int i = 0; i < disp.length(); i++)
            {
                avg += cnoise(uv * disp[i].xy + iTime) * disp[i].z - disp[i].z * 0.5;
            }
            avg /= float(disp.length());

            // Displace vertically.
            vec2 st = vec2(uv.x,
                           uv.y + clamp(avg * smoothstep(0.1, -1.0, uv.y), -0.1, 0.1));

            // Compose output gradients.
            fragColor.rgb = mix(vec3(0.85, 0.55, 0),
                                vec3(0.90, 0.40, 0),
                                sqrt(abs(st.y * st.y * st.y)) * 28.0) * fin(uv)
                                /* Mask sun */
                                * smoothstep(0.25 + dy, 0.25, length(st))
                                /* Vingette + Background tint */
                                + smoothstep(2.0, 0.5, length(uv)) * 0.1;
        }

        void main() {
            mainImage(fragColor, gl_FragCoord.xy);
            fragColor.a = 1.0;
        }