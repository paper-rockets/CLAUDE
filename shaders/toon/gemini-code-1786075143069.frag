#version 300 es
    precision highp float;

    uniform vec3 iResolution;
    uniform float iTime;
    uniform vec2 iOffset;
    uniform float iZoom;

    out vec4 fragColor;

    float hash(vec3 p) {
      p = fract(p * vec3(443.897, 441.423, 437.195));
      p += dot(p, p.yxz + 19.19);
      return fract((p.x + p.y) * p.z);
    }

    float noise3d(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      return mix(
        mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
        f.z
      );
    }

    float fbm3d(vec3 p, int octaves) {
      float value = 0.0;
      float amplitude = 0.5;
      float frequency = 1.0;
      for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        value += amplitude * noise3d(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
      }
      return value;
    }

    void mainImage( out vec4 fragColor, in vec2 fragCoord )
    {
        float t = iTime * .2;
        
        vec2 uv = ( fragCoord -.5 * iResolution.xy ) / iResolution.y;
        
        uv = (uv - iOffset) / iZoom;

        vec2 st = vec2(
            length( uv ) * 1.5,
            atan( uv.y, uv.x )
        );
        
        st.y += st.x * 1.1;
            
        float x = fbm3d(
            vec3(
                sin( st.y ),
                cos( st.y ),
                pow( st.x, .3 ) + t * .1
            ),
            3
        );
        float y = fbm3d(
            vec3(
                cos( 1. - st.y ),
                sin( 1. - st.y ),
                pow( st.x, .5 ) + t * .1
            ),
            4
        );
        
        float r = fbm3d(
            vec3(
                x,
                y,
                st.x + t * .3
            ),
            5
        );
        r = fbm3d(
            vec3(
                r - x,
                r - y,
                r + t * .3
            ),
            6
        );
        
        float c = ( r + st.x * 5. ) / 6.;
        
        fragColor = vec4(
            smoothstep( .3, .4, c ),
            smoothstep( .4, .55, c ),
            smoothstep( .2, .55, c ),
            1.0
        );
    }

    void main() {
      mainImage(fragColor, gl_FragCoord.xy);
    }