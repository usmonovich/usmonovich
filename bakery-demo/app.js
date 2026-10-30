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
  let col = [0.97,0.45,0.62];
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
float smax(float a,float b,float k){return -smin(-a,-b,k);}
vec3 toLocal(vec3 p){vec3 d=p; d.yz*=rot(-0.95); d.xz*=rot(uTime*0.35+uScroll*2.5); return d;}
float edgeH(float th){return 0.03+0.07*sin(th*5.0+1.0)+0.03*sin(th*11.0+2.0);}
vec2 mapM(vec3 p){
  if(length(p)>2.9) return vec2(length(p)-2.7,0.0);
  vec3 d=toLocal(p);
  vec2 q=vec2(length(d.xz)-0.8,d.y);
  float th=atan(d.z,d.x); float ph=atan(q.y,q.x);
  float lq=length(q);
  float dough=lq-0.37+0.005*sin(th*23.0)*sin(ph*9.0);
  float glz=smax(lq-0.4,edgeH(th)-d.y,0.05);
  vec2 m=vec2(dough,1.0);
  if(glz<m.x) m=vec2(glz,2.0);
  for(int i=0;i<3;i++){
    float fi=float(i);
    float ang=uTime*0.4+fi*2.094+uScroll*2.0;
    vec3 c=vec3(cos(ang)*1.9,0.35*sin(uTime*0.8+fi*2.0)+(fi-1.0)*0.28,sin(ang)*1.5);
    vec3 mm=p-c; mm.xy*=rot(0.5+fi); mm.xz*=rot(uTime*0.6+fi);
    float rr=length(mm.xz);
    float shell=min(sdRB2(vec2(rr,mm.y-0.075),vec2(0.15,0.045),0.045),sdRB2(vec2(rr,mm.y+0.075),vec2(0.15,0.045),0.045));
    float fill=sdRB2(vec2(rr,mm.y),vec2(0.12,0.03),0.02);
    if(shell<m.x) m=vec2(shell,3.0+fi);
    if(fill<m.x) m=vec2(fill,6.0);
  }
  return m;
}
float map(vec3 p){return mapM(p).x;}
vec3 calcN(vec3 p){vec2 e=vec2(1.0,-1.0)*0.0015;return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));}
vec3 env(vec3 r){
  vec3 c=mix(vec3(0.72,0.58,0.58),vec3(1.0,0.96,0.92),smoothstep(-0.5,0.9,r.y));
  c+=smoothstep(0.75,0.95,dot(r,normalize(vec3(0.4,0.8,0.6))))*vec3(1.5,1.4,1.3);
  c+=smoothstep(0.85,0.98,dot(r,normalize(vec3(-0.8,0.3,0.4))))*vec3(0.9,1.0,1.2);
  return c;
}
vec3 sparkle(vec2 uv){
  vec3 c=vec3(0.0);
  for(int i=0;i<3;i++){
    float fi=float(i); float sc=4.0+fi*4.0;
    vec2 g=uv*sc+vec2(fi*9.7,-uTime*(0.03+0.02*fi));
    vec2 id=floor(g); vec2 f=fract(g)-0.5;
    float h=hash(id+fi*5.0);
    vec2 off=(vec2(hash(id+1.3),hash(id+2.9))-0.5)*0.5;
    float r=0.06+0.1*h; float d=length(f-off);
    float m=smoothstep(r,r*0.5,d)*step(0.6,h);
    float ring=smoothstep(r,r-0.012,d)-smoothstep(r-0.012,r-0.03,d);
    c+=(m*0.18+ring*0.35*step(0.6,h))*vec3(1.0,0.86,0.55)/(1.0+fi);
  }
  return c;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  vec2 suv=uv-uOff*0.3;
  vec3 ro=vec3(0.0,0.0,7.2);
  vec3 rd=normalize(vec3(suv,-uFocal));
  float yaw=uMouse.x*0.5; float pitch=0.05-uMouse.y*0.3;
  ro.xz*=rot(yaw); rd.xz*=rot(yaw);
  ro.yz*=rot(pitch); rd.yz*=rot(pitch);
  float t=0.0; vec2 hit=vec2(0.0); bool ok=false;
  for(int i=0;i<110;i++){
    vec2 d=mapM(ro+rd*t);
    if(d.x<0.0012){ok=true;hit=d;break;}
    t+=d.x*0.6;
    if(t>12.0)break;
  }
  vec3 bg=mix(vec3(1.0,0.84,0.82),vec3(1.0,0.96,0.92),smoothstep(-0.6,0.7,uv.y));
  bg+=sparkle(uv);
  bg=mix(bg,vec3(1.0,0.97,0.94),exp(-length(suv)*2.2)*0.55);
  vec3 col=bg;
  if(ok){
    vec3 p=ro+rd*t; vec3 N=calcN(p); vec3 V=-rd; float ndv=clamp(dot(N,V),0.0,1.0);
    vec3 R=reflect(rd,N); vec3 e=env(R);
    vec3 L=normalize(vec3(0.5,0.8,0.7));
    float ao=0.0; for(int i=0;i<5;i++){float h=0.02+0.07*float(i);ao+=(h-map(p+N*h));}
    ao=clamp(1.0-ao*2.0,0.0,1.0);
    float fres=pow(1.0-ndv,4.0);
    float dif=clamp((dot(N,L)+0.4)/1.4,0.0,1.0);
    float id=hit.y;
    vec3 dl=toLocal(p);
    float th=atan(dl.z,dl.x);
    vec2 q=vec2(length(dl.xz)-0.8,dl.y);
    float ph=atan(q.y,q.x);
    vec3 o;
    if(id<1.5){
      vec3 base=mix(vec3(0.84,0.55,0.26),vec3(0.62,0.36,0.14),clamp(0.25-dl.y*1.6,0.0,1.0));
      base*=0.9+0.2*hash(floor(dl.xz*70.0)+floor(dl.y*70.0));
      o=base*(0.3+dif*0.85)*ao+e*0.03;
    }else if(id<2.5){
      vec3 base=uCol;
      vec2 g=vec2(th/6.28318*42.0,ph/6.28318*19.0);
      vec2 cid=floor(g); vec2 f=fract(g)-0.5;
      f-=(vec2(hash(cid+1.1),hash(cid+2.2))-0.5)*0.35;
      f=rot(hash(cid+3.3)*6.28318)*f;
      float dd=length(vec2(max(abs(f.x)-0.17,0.0),f.y));
      float mask=smoothstep(0.1,0.07,dd)*step(0.5,hash(cid))*step(0.12,dl.y-edgeH(th));
      vec3 sc=0.5+0.5*cos(6.28318*(hash(cid+9.1)+vec3(0.0,0.33,0.67)));
      vec3 gl=base*(0.38+dif*0.8)*ao+base*0.12*pow(1.0-ndv,2.0)+e*(0.05+0.8*fres)*0.55;
      gl+=vec3(1.0)*pow(max(dot(R,L),0.0),140.0)*1.6;
      o=mix(gl,sc*(0.45+dif*0.7)+vec3(1.0)*pow(max(dot(R,L),0.0),60.0)*0.5,mask);
    }else if(id<5.5){
      vec3 base=id<3.5?vec3(1.0,0.68,0.76):(id<4.5?vec3(0.6,0.9,0.76):vec3(0.78,0.7,0.96));
      o=base*(0.4+dif*0.75)*ao+e*(0.04+0.45*fres)+vec3(1.0)*pow(max(dot(R,L),0.0),50.0)*0.35;
    }else{
      o=vec3(0.99,0.93,0.84)*(0.45+dif*0.7)*ao+e*0.03;
    }
    col=1.0-exp(-o*1.35);
    col=pow(col,vec3(0.4545));
  }
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
    const focal = 1.5 * Math.min(1, Math.max(0.55, aspect));
    gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uTime, time); gl.uniform2f(U.uMouse, m.x, m.y);
    gl.uniform2f(U.uOff, ox, oy); gl.uniform1f(U.uScroll, sp); gl.uniform1f(U.uFocal, focal);
    gl.uniform3f(U.uCol, cc[0], cc[1], cc[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
