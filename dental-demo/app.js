(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // reveal
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    items.forEach((el) => io.observe(el));
  } else items.forEach((el) => el.classList.add('in'));

  // burger
  const burger = document.getElementById('burger'), nav = document.getElementById('nav');
  function setMenu(o) { nav.classList.toggle('open', o); burger.setAttribute('aria-expanded', String(o)); }
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // finish / shade chips -> uniform
  let col = [0.99,0.97,0.93];
  const chips = document.querySelectorAll('.chip');
  chips.forEach((ch) => ch.addEventListener('click', () => {
    chips.forEach((c) => { c.classList.toggle('on', c === ch); c.setAttribute('aria-pressed', String(c === ch)); });
    col = ch.dataset.c.split(',').map(Number);
    const l = document.getElementById('chipLabel'); if (l) l.textContent = ch.dataset.n;
  }));

  const canvas = document.getElementById('gl');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) { root.classList.add('no-gl'); return; }
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';
  const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform vec2 uOff; uniform float uScroll; uniform float uFocal; uniform vec3 uCol;
mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
float smin(float a,float b,float k){float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float sdRB2(vec2 p,vec2 b,float r){vec2 d=abs(p)-b;return length(max(d,0.0))+min(max(d.x,d.y),0.0)-r;}
float sdBox(vec3 p,vec3 b,float r){vec3 d=abs(p)-b;return length(max(d,0.0))+min(max(d.x,max(d.y,d.z)),0.0)-r;}
float map(vec3 p){
  if(length(p)>1.9) return length(p)-1.75;
  vec3 q=p; q.xz*=rot(uTime*0.35+uScroll*2.5);
  float crown=length(vec3(q.x*0.82,q.y-0.38,q.z*0.9))-0.78;
  float cusp=1e5;
  for(int i=0;i<4;i++){
    float fi=float(i);
    vec3 c=vec3((mod(fi,2.0)*2.0-1.0)*0.34,0.9,(floor(fi*0.5)*2.0-1.0)*0.3);
    cusp=min(cusp,length(q-c)-0.2);
  }
  float d=smin(crown,cusp,0.12);
  d+=0.018*sin(q.x*9.0)*sin(q.z*9.0)*smoothstep(0.5,1.0,q.y);
  vec3 a1=vec3(-0.27,-0.1,0.0),b1=vec3(-0.2,-1.25,0.02);
  vec3 a2=vec3(0.27,-0.1,0.0),b2=vec3(0.2,-1.2,-0.02);
  vec3 pa=q-a1,ba=b1-a1; float h1=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
  float r1=length(pa-ba*h1)-mix(0.22,0.08,h1);
  vec3 pb=q-a2,bb=b2-a2; float h2=clamp(dot(pb,bb)/dot(bb,bb),0.0,1.0);
  float r2=length(pb-bb*h2)-mix(0.22,0.07,h2);
  d=smin(d,smin(r1,r2,0.1),0.3);
  return d;
}
vec3 calcN(vec3 p){vec2 e=vec2(1.0,-1.0)*0.002;return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));}
vec3 env(vec3 r){
  vec3 c=mix(vec3(0.05,0.12,0.16),vec3(0.55,0.8,0.9),smoothstep(-0.4,0.9,r.y));
  c+=smoothstep(0.8,0.96,dot(r,normalize(vec3(0.5,0.8,0.6))))*vec3(1.6,1.6,1.5);
  c+=smoothstep(0.9,0.985,dot(r,normalize(vec3(-0.8,0.3,0.5))))*vec3(0.8,1.1,1.4);
  return c;
}
vec3 bokeh(vec2 uv){
  vec3 c=vec3(0.0);
  for(int i=0;i<3;i++){
    float fi=float(i); float sc=3.0+fi*3.0;
    vec2 g=uv*sc+vec2(fi*13.1,-uTime*(0.04+0.02*fi));
    vec2 id=floor(g); vec2 f=fract(g)-0.5;
    float h=hash(id+fi*7.0);
    vec2 off=(vec2(hash(id+1.7),hash(id+3.1))-0.5)*0.5;
    float r=0.08+0.12*h; float d=length(f-off);
    float m=smoothstep(r,r*0.55,d)*step(0.55,h);
    float ring=smoothstep(r,r-0.012,d)-smoothstep(r-0.012,r-0.03,d);
    c+=(m*0.10+ring*0.18*step(0.55,h))*vec3(0.65,0.95,1.0)/(1.0+fi);
  }
  return c;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  vec2 suv=uv-uOff*0.3;
  vec3 ro=vec3(0.0,0.05,5.2);
  vec3 rd=normalize(vec3(suv,-uFocal));
  float yaw=uMouse.x*0.5; float pitch=0.15-uMouse.y*0.3;
  ro.xz*=rot(yaw); rd.xz*=rot(yaw);
  ro.yz*=rot(pitch); rd.yz*=rot(pitch);
  float t=0.0,minD=100.0; bool ok=false;
  for(int i=0;i<80;i++){
    float d=map(ro+rd*t);
    minD=min(minD,d);
    if(d<0.0012){ok=true;break;}
    t+=d*0.8;
    if(t>10.0)break;
  }
  vec3 bg=mix(vec3(0.03,0.28,0.32),vec3(0.01,0.09,0.13),smoothstep(-0.5,0.7,uv.y));
  bg+=bokeh(uv);
  bg+=exp(-length(suv)*2.5)*vec3(0.15,0.55,0.6)*0.35;
  vec3 col=bg;
  if(ok){
    vec3 p=ro+rd*t; vec3 N=calcN(p); vec3 V=-rd; float ndv=clamp(dot(N,V),0.0,1.0);
    vec3 R=reflect(rd,N); vec3 e=env(R);
    vec3 L=normalize(vec3(0.5,0.8,0.6)); vec3 L2=normalize(vec3(-0.7,0.2,0.5));
    float ao=0.0; for(int i=0;i<5;i++){float h=0.02+0.08*float(i);ao+=(h-map(p+N*h));}
    ao=clamp(1.0-ao*2.0,0.0,1.0);
    float th=clamp(-map(p-N*0.18)/0.18,0.0,1.0);
    float fres=pow(1.0-ndv,4.0);
    vec3 enamel=uCol;
    vec3 root=vec3(0.9,0.8,0.62);
    enamel=mix(enamel,root,smoothstep(-0.05,-0.6,p.y));
    enamel=mix(enamel,vec3(0.78,0.9,1.0),smoothstep(0.7,1.05,p.y)*0.35);
    float dif=clamp((dot(N,L)+0.45)/1.45,0.0,1.0);
    float dif2=clamp((dot(N,L2)+0.5)/1.5,0.0,1.0);
    float trans=pow(clamp(dot(rd,L)*0.5+0.5,0.0,1.0),3.0)*(1.0-th);
    col=enamel*(0.28+dif*0.75+dif2*0.25)*ao;
    col+=trans*vec3(1.0,0.78,0.66)*0.35;
    col+=vec3(0.55,0.8,1.0)*pow(1.0-ndv,2.5)*0.22;
    col+=e*(0.06+0.85*fres)*0.7;
    col+=vec3(1.0)*pow(max(dot(R,L),0.0),110.0)*1.4;
  }else{
    float g=exp(-minD*4.0);
    col+=vec3(0.5,0.95,1.0)*g*g*0.25;
  }
  col=1.0-exp(-col*1.2);
  col=pow(col,vec3(0.4545));
  col+=(hash(gl_FragCoord.xy+uTime)-0.5)/200.0;
  gl_FragColor=vec4(col,1.0);
}
`;
  function sh(t, s) { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x);
    if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(x)); return null; } return x; }
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { root.classList.add('no-gl'); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { root.classList.add('no-gl'); return; }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['uRes', 'uTime', 'uMouse', 'uOff', 'uScroll', 'uFocal', 'uCol'].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

  const isTouch = matchMedia('(pointer: coarse)').matches;
  const maxScale = Math.min(window.devicePixelRatio || 1, 2) * (isTouch ? 0.6 : 0.85);
  let scale = maxScale * 0.7, W = 1, H = 1;
  function resize() { W = Math.max(1, Math.floor(innerWidth * scale)); H = Math.max(1, Math.floor(innerHeight * scale)); canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H); }
  addEventListener('resize', resize); resize();

  const m = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => { m.tx = (e.clientX / innerWidth) * 2 - 1; m.ty = -((e.clientY / innerHeight) * 2 - 1); }, { passive: true });
  let sp = 0, spT = 0;
  function onScroll() { const mx = document.documentElement.scrollHeight - innerHeight; spT = mx > 0 ? Math.min(1, Math.max(0, scrollY / mx)) : 0; }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  let time = 0, last = performance.now(), ema = 16, frames = 0, running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(loop); } });
  const cc = col.slice();
  function loop(now) {
    if (!running) return;
    const dt = Math.min(now - last, 100); last = now;
    time += (dt / 1000) * (reduce ? 0.25 : 1);
    ema = ema * 0.92 + dt * 0.08;
    if (++frames % 40 === 0) {
      if (ema > 30 && scale > 0.35) { scale *= 0.85; resize(); }
      else if (ema < 15 && scale < maxScale) { scale = Math.min(maxScale, scale * 1.1); resize(); }
    }
    const k = reduce ? 0 : 0.06;
    m.x += (m.tx - m.x) * k; m.y += (m.ty - m.y) * k; sp += (spT - sp) * 0.07;
    for (let i = 0; i < 3; i++) cc[i] += (col[i] - cc[i]) * 0.12;
    const aspect = innerWidth / innerHeight, wide = aspect > 1;
    const ox = wide ? 1.3 * Math.cos(sp * 6.2832 * 1.5) : 0;
    const oy = wide ? 0.2 * Math.sin(sp * 6.2832) : 0.5 * (1 - Math.min(1, sp * 5)) + 0.2 * Math.sin(sp * 6.2832);
    const focal = 1.45 * Math.min(1, Math.max(0.55, aspect));
    gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uTime, time); gl.uniform2f(U.uMouse, m.x, m.y);
    gl.uniform2f(U.uOff, ox, oy); gl.uniform1f(U.uScroll, sp); gl.uniform1f(U.uFocal, focal);
    gl.uniform3f(U.uCol, cc[0], cc[1], cc[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
