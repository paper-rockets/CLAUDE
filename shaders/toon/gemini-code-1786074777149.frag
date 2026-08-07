precision highp float;

            uniform vec3 iResolution;
            uniform float iTime;

            const float fluid_speed = 208.0; // Drives speed, higher number will make it slower.
            float gTime = 0.;

            // 回転行列
            mat2 rot(float a) {
                float c = cos(a), s = sin(a);
                return mat2(c,s,-s,c);
            }

            float sdEllipsoid( in vec3 p, in vec3 r )
            {
                float k0 = length(p/r);
                float k1 = length(p/(r*r));
                return k0*(k0-1.0)/k1;
            }

            float sdBox( vec3 p, vec3 b )
            {
                vec3 q = abs(p) - b;
                return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
            }

            float sakura(vec3 pos, float scale) {
                pos *= scale;
                float base = sdEllipsoid(pos, vec3(.4,.6,.2)) /1.5;
                pos.xy *= 5.;
                pos.y -= 3.5;
                pos.xy *= rot(.75);
                float cut = sdBox(pos, vec3(1.,1.,1.));
                float result = min(-base,cut) *2.;
                return result;
            }

            float sakura_set(vec3 pos) {
                vec3 pos_origin = pos;
                pos = pos_origin;
                pos .y -= .1;
                float sakura1 = sakura(pos,2.);
                pos = pos_origin;
                pos .x += .35;
                pos .y += .15;
                pos.xy *= rot(.9);
                float sakura2 = sakura(pos,2.);
                pos = pos_origin;
                pos .x -= .35;
                pos .y += .15;
                pos.xy *= rot(-.9);
                float sakura3 = sakura(pos,2.);	
                pos = pos_origin;
                pos .x += .225;
                pos .y += .6;
                pos.xy *= rot(2.5);
                float sakura4 = sakura(pos,2.);	
                pos = pos_origin;
                pos .x -= .225;
                pos .y += .6;
                pos.xy *= rot(-2.5);
                float sakura5 = sakura(pos,2.);	
                float result = max(max(max(max(sakura1,sakura2),sakura3),sakura4),sakura5);
                return result;
            }

            float map(vec3 pos) {
                float sakura_set1 = sakura_set(pos);
                pos.x +=sin(gTime);
                pos.y +=sin(gTime);
                pos.z +=sin(gTime);
                pos.yz *= rot(sin(gTime * 2.)) * 2.;
                pos *= 1.5;
                float result = sakura_set1;

                return result;
            }

            float linearFog(float d, float start, float end) {
                return clamp((end - d) / (end - start), 0.0, 1.0);
            }

            float expFog(float d, float density) {
                return exp(-d * density);
            }

            float exp2Fog(float d, float density) {
                float dd = d * density;
                return exp(-dd * dd);
            }

            void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
                vec2 p = (fragCoord.xy * 2. - iResolution.xy) / min(iResolution.x, iResolution.y);
                vec3 ro = vec3(0.5, sin(iTime) * 2. + 0.3 ,iTime * 2.);
                vec3 ray = normalize(vec3(p, 1.5));

                float t = 0.01;
                vec3 col = vec3(0.);
                float ac = 0.0;

                ro.xy = ro.xy * rot(sin(iTime* .005)) * .1;
                ro.yz = ro.yz * rot(sin(iTime* .005)) * 0.05;
                ray.xy = ray.xy * rot(sin(iTime * .03) * 5.);
                ray.yz = ray.yz * rot(sin(iTime * .03) * 5.);

                for (int i = 0; i < 99; i++){
                    vec3 pos = ro + ray * t;
                    pos = mod(pos-2., 4.) -2.;
                    gTime = iTime -float(i) * 0.01;
                    pos.xy = pos.xy * rot(iTime);
                    
                    pos.yz = pos.yz * rot(sin(iTime) /2.);
                    
                    float d = map(pos);

                    d = max(abs(d), 0.02);
                    ac += exp(-d*3.);

                    t += d* 0.15;
                }

                for(int i=1;i<140;i++)
                {
                    vec2 newp=p + iTime*0.005;
                    newp.x+=0.9/float(i)*sin(float(i)*p.y+iTime/fluid_speed+0.3*float(i)) + sin(iTime)* 0.01;
                    newp.y+=0.85/float(i)*sin(float(i)*p.x+iTime/fluid_speed+0.3*float(i+10) + sin(iTime)* 0.01);
                    p=newp;
                }
                
                col = vec3(ac * 0.04);

                col += smoothstep(0.5, 1.,sin(iTime)) * .15 * vec3 ( 1.0, 0.3, 0.5 );
                col += smoothstep(0.5, 1.,cos(iTime)) * .15 * vec3 ( .0, 0.3, 1.0 );

                col.z += 0.54;
                col.y = col.y * abs(sin(iTime) / 4.) + 0.540;

                fragColor = vec4(col ,1.0 - t * 0.005);
            }

            void main() {
                mainImage(gl_FragColor, gl_FragCoord.xy);
            }