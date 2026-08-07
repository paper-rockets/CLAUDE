#version 300 es
        precision highp float;

        out vec4 fragColor;

        uniform vec3 iResolution;
        uniform float iTime;
        uniform vec4 iMouse;

        #define SHADERTOY
        #define _in(T) const in T
        #define _inout(T) inout T
        #define _out(T) out T
        #define _begin(type) type (
        #define _end )
        #define _mutable(T) T
        #define _constant(T) const T
        #define mul(a, b) (a) * (b)

        #define u_res iResolution
        #define u_time iTime
        #define u_mouse iMouse

        #define PI 3.14159265359

        struct ray_t {
            vec3 origin;
            vec3 direction;
        };
        #define BIAS 1e-4

        struct sphere_t {
            vec3 origin;
            float radius;
            int material;
        };

        struct plane_t {
            vec3 direction;
            float distance;
            int material;
        };

        struct hit_t {
            float t;
            int material_id;
            vec3 normal;
            vec3 origin;
        };
        #define max_dist 1e8
        _constant(hit_t) no_hit = _begin(hit_t)
            float(max_dist + 1e1),
            -1,
            vec3(0., 0., 0.),
            vec3(0., 0., 0.)
        _end;

        // ----------------------------------------------------------------------------
        // Utilities
        // ----------------------------------------------------------------------------

        ray_t get_primary_ray(
            _in(vec3) cam_local_point,
            _inout(vec3) cam_origin,
            _inout(vec3) cam_look_at
        ){
            vec3 fwd = normalize(cam_look_at - cam_origin);
            vec3 up = vec3(0, 1, 0);
            vec3 right = cross(up, fwd);
            up = cross(fwd, right);

            ray_t r = _begin(ray_t)
                cam_origin,
                normalize(fwd + up * cam_local_point.y + right * cam_local_point.x)
            _end;
            return r;
        }

        mat2 rotate_2d(_in(float) angle_degrees) {
            float angle = radians(angle_degrees);
            float _sin = sin(angle);
            float _cos = cos(angle);
            return mat2(_cos, -_sin, _sin, _cos);
        }

        vec3 linear_to_srgb(_in(vec3) color) {
            const float p = 1. / 2.2;
            return vec3(pow(color.r, p), pow(color.g, p), pow(color.b, p));
        }

        // ----------------------------------------------------------------------------
        // Volumetric Utilities
        // ----------------------------------------------------------------------------

        struct volume_sampler_t {
            vec3 origin;
            vec3 pos;
            float height;

            float coeff_absorb;
            float T;

            vec3 C;
            float alpha;
        };

        volume_sampler_t begin_volume(
            _in(vec3) origin,
            _in(float) coeff_absorb
        ){
            volume_sampler_t v = _begin(volume_sampler_t)
                origin, origin, 0.,
                coeff_absorb, 1.,
                vec3(0., 0., 0.), 0.
            _end;
            return v;
        }

        float illuminate_volume(
            _inout(volume_sampler_t) vol,
            _in(vec3) V,
            _in(vec3) L
        );

        void integrate_volume(
            _inout(volume_sampler_t) vol,
            _in(vec3) V,
            _in(vec3) L,
            _in(float) density,
            _in(float) dt
        ){
            float T_i = exp(-vol.coeff_absorb * density * dt);
            vol.T *= T_i;
            vol.C += vol.T * illuminate_volume(vol, V, L) * density * dt;
            vol.alpha += (1. - T_i) * (1. - vol.alpha);
        }

        #define cld_march_steps (50)
        #define cld_coverage (.3125)
        #define cld_thick (90.)
        #define cld_absorb_coeff (1.)
        #define cld_wind_dir vec3(0, 0, -u_time * .2)
        #define cld_sun_dir normalize(vec3(0, 0, -1))

        // ----------------------------------------------------------------------------
        // Simplex Noise (Ashima Arts)
        // ----------------------------------------------------------------------------

        vec3 mod289(vec3 x) {
            return x - floor(x * (1.0 / 289.0)) * 289.0;
        }

        vec4 mod289(vec4 x) {
            return x - floor(x * (1.0 / 289.0)) * 289.0;
        }

        vec4 permute(vec4 x) {
            return mod289(((x*34.0)+1.0)*x);
        }

        vec4 taylorInvSqrt(vec4 r) {
            return 1.79284291400159 - 0.85373472095314 * r;
        }

        float snoise(vec3 v) {
            const vec2 C = vec2(1.0/6.0, 1.0/3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

            vec3 i  = floor(v + dot(v, C.yyy));
            vec3 x0 = v - i + dot(i, C.xxx);

            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min(g.xyz, l.zxy);
            vec3 i2 = max(g.xyz, l.zxy);

            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;

            i = mod289(i);
            vec4 p = permute(permute(permute(
                        i.z + vec4(0.0, i1.z, i2.z, 1.0))
                      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                      + i.x + vec4(0.0, i1.x, i2.x, 1.0));

            float n_ = 0.142857142857;
            vec3 ns = n_ * D.wyz - D.xzx;

            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_);

            vec4 x = x_ * ns.x + ns.yyyy;
            vec4 y = y_ * ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);

            vec4 b0 = vec4(x.xy, y.xy);
            vec4 b1 = vec4(x.zw, y.zw);

            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));

            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

            vec3 p0 = vec3(a0.xy, h.x);
            vec3 p1 = vec3(a0.zw, h.y);
            vec3 p2 = vec3(a1.xy, h.z);
            vec3 p3 = vec3(a1.zw, h.w);

            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;

            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }
        #define noise(x) snoise(x)

        // ----------------------------------------------------------------------------
        // FBM & Rendering
        // ----------------------------------------------------------------------------

        #define DECL_FBM_FUNC(_name, _octaves, _basis) float _name(_in(vec3) pos, _in(float) lacunarity, _in(float) init_gain, _in(float) gain) { vec3 p = pos; float H = init_gain; float t = 0.; for (int i = 0; i < _octaves; i++) { t += _basis * H; p *= lacunarity; H *= gain; } return t; }

        DECL_FBM_FUNC(fbm, 4, noise(p))
        DECL_FBM_FUNC(fbm_clouds, 5, abs(noise(p)))

        vec3 render_sky_color(_in(vec3) eye_dir) {
            _constant(vec3) sun_color = vec3(1., .7, .55);
            float sun_amount = max(dot(eye_dir, cld_sun_dir), 0.);

            vec3 sky = mix(vec3(.0, .1, .4), vec3(.3, .6, .8), 1.0 - eye_dir.y);
            sky += sun_color * min(pow(sun_amount, 1500.0) * 5.0, 1.0);
            sky += sun_color * min(pow(sun_amount, 10.0) * .6, 1.0);

            return sky;
        }

        float density_func(_in(vec3) pos, _in(float) h) {
            vec3 p = pos * .001 + cld_wind_dir;
            float dens = fbm_clouds(p * 2.032, 2.6434, .5, .5);
            dens *= smoothstep(cld_coverage, cld_coverage + .035, dens);
            return dens;
        }

        float illuminate_volume(_inout(volume_sampler_t) cloud, _in(vec3) V, _in(vec3) L) {
            return exp(cloud.height) / 1.95;
        }

        vec4 render_clouds(_in(ray_t) eye) {
            const int steps = cld_march_steps;
            const float march_step = cld_thick / float(steps);

            vec3 projection = eye.direction / eye.direction.y;
            vec3 iter = projection * march_step;

            float cutoff = dot(eye.direction, vec3(0, 1, 0));

            volume_sampler_t cloud = begin_volume(
                eye.origin + projection * 100.,
                cld_absorb_coeff);

            for (int i = 0; i < steps; i++) {
                cloud.height = (cloud.pos.y - cloud.origin.y) / cld_thick;
                float dens = density_func(cloud.pos, cloud.height);

                integrate_volume(cloud, eye.direction, cld_sun_dir, dens, march_step);
                cloud.pos += iter;

                if (cloud.alpha > .999) break;
            }

            return vec4(cloud.C, cloud.alpha * smoothstep(.0, .2, cutoff));
        }

        void setup_camera(_inout(vec3) eye, _inout(vec3) look_at) {
            eye = vec3(0, 1., 0);
            
            // Mouse Orbit
            vec2 m = u_mouse.xy / u_res.xy;
            if (u_mouse.z < 0.5) m = vec2(0.5, 0.5); // Default position
            
            float yaw = (m.x - 0.5) * 3.0;
            float pitch = (m.y - 0.5) * 1.5;
            
            look_at = eye + vec3(sin(yaw), 0.6 + pitch, -cos(yaw));
        }

        vec3 render(_in(ray_t) eye_ray, _in(vec3) point_cam) {
            vec3 sky = render_sky_color(eye_ray.direction);
            if (dot(eye_ray.direction, vec3(0, 1, 0)) < 0.05) return sky;

            vec4 cld = render_clouds(eye_ray);
            vec3 col = mix(sky, cld.rgb, cld.a);

            return col;
        }

        #define FOV 1.0

        void mainImage(_out(vec4) fragColor, vec2 fragCoord) {
            vec2 aspect_ratio = vec2(u_res.x / u_res.y, 1.0);
            vec3 color = vec3(0.0);

            vec3 eye, look_at;
            setup_camera(eye, look_at);

            vec2 point_ndc = fragCoord.xy / u_res.xy;
            vec3 point_cam = vec3(
                (2.0 * point_ndc - 1.0) * aspect_ratio * FOV,
                -1.0);

            ray_t ray = get_primary_ray(point_cam, eye, look_at);

            color += render(ray, point_cam);

            fragColor = vec4(linear_to_srgb(color), 1.0);
        }

        void main() {
            mainImage(fragColor, gl_FragCoord.xy);
        }