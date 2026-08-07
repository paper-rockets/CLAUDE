#version 300 es
            precision highp float;

            uniform vec3 iResolution;
            uniform float iTime;
            uniform vec4 iMouse;
            uniform sampler2D iChannel0;

            out vec4 fragColor;

            #define ITERATIONS 70
            #define pi 3.14159265
            #define R(p, a) p=cos(a)*p+sin(a)*vec2(p.y, -p.x)

            mat4 rotate(vec3 axis, float angle) {
                axis = normalize(axis);
                float s = sin(angle);
                float c = cos(angle);
                float oc = 1.0 - c;
                
                return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                            oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                            oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                            0.0,                                0.0,                                0.0,                                1.0);
            }

            float noise( in vec3 x ) {
                vec3 p = floor(x);
                vec3 f = fract(x);
                f = f*f*(3.0-2.0*f);
                vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
                vec2 rg = textureLod( iChannel0, (uv+ 0.5)/256.0, 0.0 ).yx;
                return 1. - 0.82*mix( rg.x, rg.y, f.z );
            }

            float fbm(vec3 p) {
               return noise(p*.04125)*.5 + noise(p*.125)*.25 + noise(p*.25)*.125 + noise(p*.4)*.2;
            }

            float length2( vec2 p ) {
                return sqrt( p.x*p.x + p.y*p.y );
            }

            float length8( vec2 p ) {
                p = p*p; p = p*p; p = p*p;
                return pow( p.x + p.y, 1.0/8.0 );
            }

            float Disk( vec3 p, vec3 t ) {
                vec2 q = vec2(length2(p.xy) -t.x,p.z*0.7);
                return max(length8(q)-t.y, abs(p.z) - t.z);
            }

            const float nudge = 0.9;
            float normalizer = 1.0 / sqrt(1.0 + nudge*nudge);

            float SpiralNoiseC(vec3 p) {
                float n = 0.0;
                float iter = 2.0;
                for (int i = 0; i < 8; i++) {
                    n += -abs(sin(p.y*iter) + cos(p.x*iter)) / iter;
                    p.xy += vec2(p.y, -p.x) * nudge;
                    p.xy *= normalizer;
                    p.xz += vec2(p.z, -p.x) * nudge;
                    p.xz *= normalizer;
                    iter *= 1.733733;
                }
                return n;
            }

            float NebulaNoise(vec3 p) {
                float final = Disk(p.xzy,vec3(2.0,2.0,0.3));
                final += fbm(p*60.0);
                final += SpiralNoiseC(p.zxy*0.7+1.6)*2.0;
                return final;
            }

            float map(vec3 p) {
                R(p.xz, iMouse.x*0.008*pi+iTime*0.1);
                p = (vec4(p,1.0) * rotate(vec3(1.0, 0.0, 0.0), pi / 4.0)).rgb;
                float NebNoise = abs(NebulaNoise(p/0.5)*0.5);
                return NebNoise+0.07;
            }

            vec3 computeColor( float density, float radius ) {
                vec3 result = mix( vec3(1.0), vec3(0.5), density );
                vec3 colCenter = 7.*vec3(0.8,0.9,1.0).rgb;
                vec3 colEdge = 1.5*vec3(0.48,0.53,0.5).rgb;
                result *= mix( colCenter, colEdge, min( (radius+.05)/.9, 1.15 ) );
                return result;
            }

            bool RaySphereIntersect(vec3 org, vec3 dir, out float near, out float far) {
                float b = dot(dir, org);
                float c = dot(org, org) - 10.0;
                float delta = b*b - c;
                if( delta < 0.0) return false;
                float deltasqrt = sqrt(delta);
                near = -b - deltasqrt;
                far = -b + deltasqrt;
                return far > 0.0;
            }

            void mainImage( out vec4 fragColor, in vec2 fragCoord ) {   
                float zoom = (iMouse.y / iResolution.y) * 2.0;

                vec3 rd = normalize(vec3((fragCoord.xy-0.5*iResolution.xy)/iResolution.y, 1.));
                vec3 ro = vec3(0., 0., -6.0 + (5.0 * zoom));
                
                float ld=0., td=0., w=0.;
                float d=1., t=0.;
                const float h = 0.1;
                vec4 sum = vec4(0.0);
                float min_dist=0.0, max_dist=0.0;

                if(RaySphereIntersect(ro, rd, min_dist, max_dist)) {
                    t = min_dist*step(t,min_dist);
               
                    for (int i=0; i<ITERATIONS; i++) {
                        vec3 pos = ro + t*rd;

                        if(td>0.9 || t>20. || sum.a > 0.99 || t>max_dist) break;
                        
                        float d = map(pos);
                        d = max(d,0.0);
                        
                        vec3 ldst = vec3(0.0)-pos;
                        float lDist = max(length(ldst), 0.001);

                        float _T = lDist*2.3+2.6;
                        vec3 lightColor=0.4+0.5*cos(_T + pi * 0.5*vec3(-0.5,0.05,0.5));
                        
                        sum.rgb+=(vec3(0.57,1.85,1.00)/(lDist*lDist*10.)/70.0);
                        sum.rgb+=(lightColor/exp(lDist*lDist*lDist*.05)/30.0);
                        
                        if (d<h) {
                            ld = h - d;
                            w = (1. - td) * ld;
                            td += w + 1./200.;
                        
                            vec4 col = vec4( computeColor(td,lDist), td );
                            sum += sum.a * vec4(sum.rgb, 0.0) * 0.2; 
                            col.a *= 0.2;
                            col.rgb *= col.a;
                            sum = sum + col*(1.0 - sum.a);  
                        }
                      
                        td += 1./70.;
                        t += max(d * 0.1 * max(min(length(ldst),length(ro)),1.0), 0.01);
                    }
                    
                    sum *= 1. / exp( ld * 0.2 ) * 0.6;
                    sum = clamp( sum, 0.0, 1.0 );
                    sum.xyz = sum.xyz*sum.xyz*(3.0-2.0*sum.xyz);
                }

                fragColor = vec4(sum.xyz,1.0);
            }

            void main() {
                mainImage(fragColor, gl_FragCoord.xy);
            }