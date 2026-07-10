/* ============ DreamWave — dark water ripple simulation ============ */
/* Classic two-buffer heightfield ripple, rendered as grey light on black water. */

(function () {
  const canvas = document.getElementById("water");
  const ctx = canvas.getContext("2d", { alpha: false });

  const SCALE = 3;            // simulation resolution: 1 cell per SCALE px
  const DAMPING = 0.992;      // how quickly ripples fade (applied twice per frame)
  let W = 0, H = 0;           // sim grid size
  let curr, prev;             // height buffers
  let img;                    // ImageData at sim resolution
  let offscreen;              // offscreen canvas we upscale from

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    W = Math.max(2, Math.ceil(window.innerWidth / SCALE));
    H = Math.max(2, Math.ceil(window.innerHeight / SCALE));
    curr = new Float32Array(W * H);
    prev = new Float32Array(W * H);
    offscreen = document.createElement("canvas");
    offscreen.width = W;
    offscreen.height = H;
    img = offscreen.getContext("2d").createImageData(W, H);
    // opaque black base
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 4; d[i + 1] = 6; d[i + 2] = 10; d[i + 3] = 255;
    }
  }

  function drop(px, py, strength = 520, radius = 3) {
    const cx = Math.round(px / SCALE);
    const cy = Math.round(py / SCALE);
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        const dist = Math.hypot(x, y);
        if (dist > radius) continue;
        const gx = cx + x, gy = cy + y;
        if (gx < 1 || gx >= W - 1 || gy < 1 || gy >= H - 1) continue;
        prev[gy * W + gx] += strength * (1 - dist / radius);
      }
    }
  }

  function step() {
    for (let y = 1; y < H - 1; y++) {
      const row = y * W;
      for (let x = 1; x < W - 1; x++) {
        const i = row + x;
        curr[i] =
          ((prev[i - 1] + prev[i + 1] + prev[i - W] + prev[i + W]) / 2 - curr[i]) *
          DAMPING;
      }
    }
    const tmp = prev; prev = curr; curr = tmp;
  }

  function render() {
    const d = img.data;
    for (let y = 1; y < H - 1; y++) {
      const row = y * W;
      for (let x = 1; x < W - 1; x++) {
        const i = row + x;
        // directional shading: light falls from the upper left, like a
        // moon over water — rings get a lit side and a shadow side
        const sx = prev[i - 1] - prev[i + 1];
        const sy = prev[i - W] - prev[i + W];
        let base = (sx * 0.6 + sy) * 1.1;
        if (base < 0) base = -base * 0.45; // shadow side stays darker
        if (base > 150) base = 150;
        // hard specular glint where the slope is steep — glossy liquid
        let glint = base > 70 ? (base - 70) * 1.6 : 0;
        if (glint > 105) glint = 105;
        // faint chromatic fringe on ring edges (iridescent highlight)
        const cr = sx > 0 ? sx * 0.15 : 0;
        const cb = sx < 0 ? -sx * 0.15 : 0;
        const p = i * 4;
        d[p]     = 4  + base * 0.72 + glint + cr;
        d[p + 1] = 7  + base * 0.80 + glint;
        d[p + 2] = 13 + base * 0.95 + glint + cb; // deep-water blue in the dark
      }
    }
    offscreen.getContext("2d").putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
  }

  let frame = 0;
  function loop() {
    step();
    step(); // two sim steps per frame: waves travel like real water
    render();
    frame++;
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  resize();

  loop();

  /* ---- opening moment: a single droplet falls and strikes the water ---- */
  const droplet = document.getElementById("droplet");
  droplet.addEventListener("animationend", () => {
    droplet.remove();
    drop(window.innerWidth / 2, window.innerHeight * 0.52, 750, 3);
  });

  /* ---- interactions: every click ripples, anywhere on the site ---- */
  window.addEventListener("pointerdown", (e) => {
    drop(e.clientX, e.clientY, 620, 3);
  });

  // gentle wake as the cursor moves (very subtle)
  let lastMove = 0;
  window.addEventListener("pointermove", (e) => {
    const now = performance.now();
    if (now - lastMove > 90) {
      drop(e.clientX, e.clientY, 55, 1);
      lastMove = now;
    }
  });

  /* ---- gate → site transition ---- */
  const gate = document.getElementById("gate");
  const site = document.getElementById("site");
  const enterBtn = document.getElementById("enter-btn");

  enterBtn.addEventListener("click", (e) => {
    const r = enterBtn.getBoundingClientRect();
    drop(r.left + r.width / 2, r.top + r.height / 2, 850, 4);
    gate.classList.add("gone");
    window.scrollTo({ top: 0, behavior: "instant" });
    setTimeout(() => {
      site.classList.add("awake");
      site.setAttribute("aria-hidden", "false");
      revealVisible();
    }, 650);
  });

  /* ---- reveal-on-scroll ---- */
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          observer.unobserve(en.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  function revealVisible() {
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
  }

  /* ---- screenshot carousels ---- */
  document.querySelectorAll(".carousel").forEach((carousel) => {
    const track = carousel.querySelector(".carousel-track");
    if (!track) return;
    // hide any slide whose screenshot hasn't been added yet
    track.querySelectorAll(".shot img").forEach((im) => {
      im.addEventListener("error", () => { im.closest(".shot").style.display = "none"; });
    });
    const step = () => (track.querySelector(".shot")?.offsetWidth || 260) + 32;
    carousel.querySelector(".car-prev")?.addEventListener("click", () =>
      track.scrollBy({ left: -step(), behavior: "smooth" })
    );
    carousel.querySelector(".car-next")?.addEventListener("click", () =>
      track.scrollBy({ left: step(), behavior: "smooth" })
    );
  });
})();
