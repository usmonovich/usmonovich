(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- reveal on scroll ----------
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting) {
          e.target.style.transitionDelay = (e.target.dataset.d || 0) + 'ms';
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach((el, i) => { el.dataset.d = (i % 4) * 70; io.observe(el); });
  } else {
    items.forEach((el) => el.classList.add('in'));
  }

  // ---------- WebGL iridescent raymarched blob ----------
  const canvas = document.getElementById('gl');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) { root.classList.add('no-gl'); return; }

  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform vec2 uOff; uniform float uScroll; uniform float uFocal;

mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
float smin(float a,float b,float k){float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}

float map(vec3 p){
  float t=uTime*0.35+uScroll*2.0;
  vec3 q=p;
  q.xz*=rot(t*0.5);
  q.xy*=rot(t*0.37);
  float disp=0.11*sin(q.x*3.0+t*1.7)*sin(q.y*3.1+t*1.3)*sin(q.z*2.9+t*1.9)
            +0.035*sin(q.x*7.0-t*2.0+q.y*6.0+q.z*5.0);
  float d=length(p)-1.05-disp;
  for(int i=0;i<3;i++){
    float fi=float(i);
    vec3 c=vec3(cos(t*(0.9+fi*0.3)+fi*2.1)*1.55,
                sin(t*(0.7+fi*0.25)+fi*1.7)*1.0,
                sin(t*(0.8+fi*0.2)+fi*2.4)*1.3);
    d=smin(d,length(p-c)-(0.26+0.05*fi),0.6);
  }
  return d;
}
vec3 calcN(vec3 p){
  vec2 e=vec2(1.0,-1.0)*0.002;
  return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));
}
vec3 env(vec3 r){
  vec3 c=mix(vec3(0.02,0.03,0.08),vec3(0.45,0.55,0.95),smoothstep(-0.4,1.0,r.y));
  float l1=smoothstep(0.78,0.98,dot(r,normalize(vec3(0.5,0.8,0.6))));
  float l2=smoothstep(0.82,0.99,dot(r,normalize(vec3(-0.8,0.2,0.5))));
  float l3=smoothstep(0.85,0.99,dot(r,normalize(vec3(0.1,-0.7,-0.7))));
  c+=l1*vec3(1.4,1.25,1.1)+l2*vec3(0.5,0.8,1.5)+l3*vec3(1.2,0.5,0.9);
  c+=exp(-abs(r.y)*7.0)*vec3(0.35,0.3,0.5);
  return c;
}
vec3 film(float th){
  return 0.5+0.5*cos(6.28318*(th+vec3(0.0,0.33,0.67)));
}
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  vec2 suv=uv-uOff*0.3;
  vec3 ro=vec3(0.0,0.0,5.2);
  vec3 rd=normalize(vec3(suv,-uFocal));
  float yaw=uMouse.x*0.6+uTime*0.08;
  float pitch=-uMouse.y*0.4;
  ro.xz*=rot(yaw); rd.xz*=rot(yaw);
  ro.yz*=rot(pitch); rd.yz*=rot(pitch);

  float t=0.0, minD=100.0; bool hit=false;
  for(int i=0;i<72;i++){
    float d=map(ro+rd*t);
    minD=min(minD,d);
    if(d<0.0015){hit=true;break;}
    t+=d*0.85;
    if(t>10.0)break;
  }

  // background: gradient + stars
  vec3 bg=mix(vec3(0.012,0.016,0.035),vec3(0.05,0.03,0.10),smoothstep(-0.6,0.8,uv.y+0.2*sin(uv.x*2.0+uTime*0.1)));
  float cell=uRes.y/70.0;
  vec2 gp=gl_FragCoord.xy/cell;
  float h=hash(floor(gp));
  float star=smoothstep(0.2,0.0,length(fract(gp)-0.5))*step(0.992,h);
  bg+=star*vec3(0.8,0.9,1.0)*(0.5+0.5*sin(uTime*1.6+h*80.0))*0.7;

  vec3 col=bg;
  if(hit){
    vec3 p=ro+rd*t;
    vec3 N=calcN(p);
    vec3 V=-rd;
    float ndv=clamp(dot(N,V),0.0,1.0);
    vec3 R=reflect(rd,N);
    float th=ndv*1.5+0.3*sin(N.x*3.0+N.y*2.0+uTime*0.3)+uTime*0.04+0.25*N.z+uScroll*0.8;
    vec3 f=film(th);
    vec3 e=env(R);
    float fres=pow(1.0-ndv,3.0);
    col=f*(0.18+e*1.05)+fres*film(th+0.25)*1.3;
    col+=pow(max(dot(R,normalize(vec3(0.5,0.8,0.6))),0.0),80.0)*1.2;
  }else{
    float g=exp(-minD*3.2);
    vec3 gc=0.5+0.5*cos(6.28318*(uTime*0.04+vec3(0.0,0.33,0.67)+minD*0.4));
    col+=gc*g*g*0.55;
  }
  col=1.0-exp(-col*1.35);
  col=pow(col,vec3(0.4545));
  col+=(hash(gl_FragCoord.xy+uTime)-0.5)/200.0;
  gl_FragColor=vec4(col,1.0);
}`;

  function sh(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  const prog = gl.createProgram();
  if (!vs || !fs) { root.classList.add('no-gl'); return; }
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { root.classList.add('no-gl'); return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['uRes', 'uTime', 'uMouse', 'uOff', 'uScroll', 'uFocal'].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

  const isTouch = matchMedia('(pointer: coarse)').matches;
  const maxScale = Math.min(window.devicePixelRatio || 1, 2) * (isTouch ? 0.6 : 0.9);
  let scale = maxScale * 0.75, W = 0, H = 0;

  function resize() {
    W = Math.max(1, Math.floor(innerWidth * scale));
    H = Math.max(1, Math.floor(innerHeight * scale));
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);
  }
  addEventListener('resize', resize);
  resize();

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = -((e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });

  let sp = 0, spT = 0;
  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    spT = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  let t0 = performance.now(), time = 0, last = t0, ema = 16, frames = 0, running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(loop); }
  });

  function loop(now) {
    if (!running) return;
    const dt = Math.min(now - last, 100);
    last = now;
    time += (dt / 1000) * (reduce ? 0.25 : 1);
    ema = ema * 0.92 + dt * 0.08;
    if (++frames % 40 === 0) {
      if (ema > 28 && scale > 0.4) { scale *= 0.85; resize(); }
      else if (ema < 15 && scale < maxScale) { scale = Math.min(maxScale, scale * 1.1); resize(); }
    }
    const k = reduce ? 0 : 0.06;
    mouse.x += (mouse.tx - mouse.x) * k;
    mouse.y += (mouse.ty - mouse.y) * k;
    sp += (spT - sp) * 0.07;

    const aspect = innerWidth / innerHeight;
    const wide = aspect > 1;
    const ox = wide ? 1.4 * Math.cos(sp * 6.2832 * 1.5) : 0;
    const oy = wide
      ? 0.25 * Math.sin(sp * 6.2832)
      : 0.9 * (1 - Math.min(1, sp * 5)) + 0.2 * Math.sin(sp * 6.2832);
    const focal = 1.7 * Math.min(1, Math.max(0.55, aspect));

    gl.uniform2f(U.uRes, W, H);
    gl.uniform1f(U.uTime, time);
    gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    gl.uniform2f(U.uOff, ox, oy);
    gl.uniform1f(U.uScroll, sp);
    gl.uniform1f(U.uFocal, focal);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
