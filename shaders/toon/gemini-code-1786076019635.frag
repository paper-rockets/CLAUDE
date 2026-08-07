uniform vec3 iResolution;
      uniform float iTime;

      #define PI 3.14159265359

      float plotFoam(vec2 st, float pct){
        return step(pct+0.06, st.y) - step(pct+0.08+abs(sin(iTime*0.25)*0.3), st.y);
      }

      float plotSand(vec2 st, float pct){
        return step(pct+0.08, st.y);
      }

      float plotSea(vec2 st, float pct){
        return step(pct-0.7, st.y) - step(pct+0.06, st.y);
      }

      float plotDeepSea(vec2 st, float pct){
        return 1.0 - step(pct-0.7, st.y);
      }

      void mainImage( out vec4 fragColor, in vec2 fragCoord )
      {
        vec2 st = fragCoord.xy / vec2(iResolution.x,iResolution.y);
        float y = sin(iTime* 0.5) * 0.4 + sin(PI * 8.0 * st.x) * 0.02 + st.x - 0.2;

        vec3 color = vec3(y);

        float foam = plotFoam(st, y);
        float sand = plotSand(st, y);
        float sea = plotSea(st, y);
        float deepSea = plotDeepSea(st, y);
        color = sea*vec3(0.0, 0.8, 1.0) + foam*vec3(1.0) + sand*vec3(1.0,0.8,0.2) + deepSea*vec3(0.2,0.3,0.8);

        fragColor = vec4(color,1.0);
      }

      void main() {
        mainImage(gl_FragColor, gl_FragCoord.xy);
      }