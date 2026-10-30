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
  let col = [0.8,0.82,0.86];
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
vec2 mapM(vec3 p){
  if(length(p)>1.6) return vec2(length(p)-1.45,0.0);
  vec3 w=p; w.xy*=rot(uTime*0.55+uScroll*3.0);
  float r=length(w.xy);
  float tire=sdRB2(vec2(r-1.0,w.z),vec2(0.1,0.22),0.08);
  float barrel=sdRB2(vec2(r-0.8,w.z),vec2(0.02,0.25),0.03);
  float lip=sdRB2(vec2(r-0.78,w.z-0.27),vec2(0.05,0.01),0.02);
  barrel=min(barrel,lip);
  float a=atan(w.y,w.x);
  float sec=6.28318/5.0;
  a=mod(a+0.5*sec,sec)-0.5*sec;
  vec2 q=vec2(cos(a),sin(a))*r;
  float off=0.07*smoothstep(0.22,0.7,q.x);
  float zc=0.04+0.2*smoothstep(0.1,0.76,r);
  float sp1=sdRB2(vec2(q.y-off,w.z-zc),vec2(0.03,0.035),0.012);
  float sp2=sdRB2(vec2(q.y+off,w.z-zc),vec2(0.03,0.035),0.012);
  float spk=max(min(sp1,sp2),max(0.14-q.x,q.x-0.8));
  float hub=sdRB2(vec2(r,w.z-0.07),vec2(0.17,0.045),0.03);
  float cap=sdRB2(vec2(r,w.z-0.12),vec2(0.07,0.02),0.02);
  float bolt=sdRB2(vec2(length(q-vec2(0.115,0.0)),w.z-0.125),vec2(0.018,0.01),0.008);
  float alloy=min(min(barrel,spk),min(hub,min(cap,bolt)));
  float disc=sdRB2(vec2(r-0.45,w.z+0.12),vec2(0.17,0.012),0.008);
  float cal=sdBox(p-vec3(0.0,-0.5,-0.06),vec3(0.14,0.09,0.07),0.03);
  vec2 m=vec2(tire,1.0);
  if(alloy<m.x) m=vec2(alloy,2.0);
  if(disc<m.x) m=vec2(disc,3.0);
  if(cal<m.x) m=vec2(cal,4.0);
  return m;
}
float map(vec3 p){return mapM(p).x;}
vec3 calcN(vec3 p){vec2 e=vec2(1.0,-1.0)*0.0015;return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));}
vec3 env(vec3 r){
  vec3 c=vec3(0.012,0.014,0.024);
  c+=smoothstep(0.55,0.9,r.y)*vec3(1.1,1.15,1.3);
  c+=smoothstep(0.955,0.985,dot(r,normalize(vec3(-0.85,0.3,0.45))))*vec3(1.3,1.35,1.5);
  c+=smoothstep(0.955,0.985,dot(r,normalize(vec3(0.85,0.25,0.5))))*vec3(1.3,1.25,1.2);
  c+=pow(max(dot(r,normalize(vec3(-0.6,-0.55,0.4))),0.0),5.0)*vec3(0.0,0.75,1.0)*0.9;
  c+=pow(max(dot(r,normalize(vec3(0.6,-0.55,0.4))),0.0),5.0)*vec3(1.0,0.1,0.6)*0.9;
  c+=exp(-abs(r.y-0.05)*10.0)*vec3(0.12,0.13,0.18);
  return c;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  vec2 suv=uv-uOff*0.3;
  vec3 ro=vec3(0.0,0.0,5.5);
  vec3 rd=normalize(vec3(suv,-uFocal));
  float yaw=0.55+uMouse.x*0.45+0.12*sin(uTime*0.4);
  float pitch=0.12-uMouse.y*0.3;
  ro.xz*=rot(yaw); rd.xz*=rot(yaw);
  ro.yz*=rot(pitch); rd.yz*=rot(pitch);
  float t=0.0,minD=100.0; vec2 hit=vec2(0.0); bool ok=false;
  for(int i=0;i<84;i++){
    vec2 d=mapM(ro+rd*t);
    minD=min(minD,d.x);
    if(d.x<0.0012){ok=true;hit=d;break;}
    t+=d.x*0.8;
    if(t>9.0)break;
  }
  vec3 bg=mix(vec3(0.006,0.008,0.016),vec3(0.03,0.03,0.06),smoothstep(-0.5,0.6,uv.y));
  float rr=length(suv);
  float ang=atan(suv.y,suv.x);
  vec3 neon=mix(vec3(0.0,0.8,1.0),vec3(1.0,0.1,0.6),0.5+0.5*sin(ang*1.0+uTime*0.3));
  bg+=exp(-abs(rr-0.40)*16.0)*neon*0.22;
  bg+=exp(-rr*3.0)*neon*0.05;
  vec3 col=bg;
  if(ok){
    vec3 p=ro+rd*t; vec3 N=calcN(p); vec3 V=-rd; float ndv=clamp(dot(N,V),0.0,1.0);
    vec3 R=reflect(rd,N); vec3 e=env(R);
    float ao=0.0; for(int i=0;i<5;i++){float h=0.02+0.07*float(i);ao+=(h-map(p+N*h));}
    ao=clamp(1.0-ao*2.2,0.0,1.0);
    float fres=pow(1.0-ndv,5.0);
    vec3 L=normalize(vec3(0.4,0.8,0.6));
    float id=hit.y;
    if(id<1.5){
      col=vec3(0.012)+e*0.05*(0.4+fres*3.0)+vec3(0.03)*pow(max(dot(R,L),0.0),20.0);
    }else if(id<2.5){
      vec3 base=uCol;
      col=base*e*1.15*ao+fres*e*0.5*ao+base*0.02;
    }else if(id<3.5){
      col=vec3(0.28,0.29,0.33)*e*0.85*ao+vec3(0.01);
    }else{
      vec3 base=vec3(0.75,0.02,0.04);
      col=base*(0.12+0.85*max(dot(N,L),0.0))*ao+e*(0.05+0.9*fres)+vec3(1.0)*pow(max(dot(R,L),0.0),90.0);
    }
  }else{
    float g=exp(-minD*5.0);
    col+=neon*g*g*0.25;
  }
  col=1.0-exp(-col*1.25);
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
    const focal = 1.5 * Math.min(1, Math.max(0.55, aspect));
    gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uTime, time); gl.uniform2f(U.uMouse, m.x, m.y);
    gl.uniform2f(U.uOff, ox, oy); gl.uniform1f(U.uScroll, sp); gl.uniform1f(U.uFocal, focal);
    gl.uniform3f(U.uCol, cc[0], cc[1], cc[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
