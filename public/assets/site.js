(function(){
  /* mark JS as alive — reveal-hiding CSS is gated on this class so a broken
     script can never leave the page content invisible */
  document.documentElement.classList.add('js');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- nav ---------- */
  var nav = document.getElementById('nav');
  if(nav){
    addEventListener('scroll', function(){ nav.classList.toggle('scrolled', scrollY > 8); }, {passive:true});
    var burger = document.getElementById('burger');
    if(burger){
      burger.addEventListener('click', function(){
        var open = nav.classList.toggle('menu-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.querySelectorAll('.mobile-menu a').forEach(function(a){
        a.addEventListener('click', function(){ nav.classList.remove('menu-open'); });
      });
    }
    /* tap-to-toggle dropdowns for touch devices */
    document.querySelectorAll('.nav-drop > .drop-trigger').forEach(function(tr){
      tr.addEventListener('touchend', function(e){
        var drop = tr.parentElement;
        if(!drop.classList.contains('open')){
          e.preventDefault();
          document.querySelectorAll('.nav-drop.open').forEach(function(d){ d.classList.remove('open'); });
          drop.classList.add('open');
        }
      });
    });
    document.addEventListener('click', function(e){
      if(!e.target.closest('.nav-drop')) document.querySelectorAll('.nav-drop.open').forEach(function(d){ d.classList.remove('open'); });
    });
  }

  /* ---------- scroll reveals ---------- */
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, {threshold:.15, rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });

  /* ---------- count-up helper ---------- */
  function countTo(el, target, ms, suffix){
    if(reduced){ el.textContent = target + (suffix||''); return; }
    var start = parseInt(el.textContent,10)||0, t0 = null;
    function frame(t){
      if(!t0) t0 = t;
      var p = Math.min((t-t0)/ms, 1), eased = 1-Math.pow(1-p,3);
      el.textContent = Math.round(start+(target-start)*eased) + (suffix||'');
      if(p<1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- hero dashboard (home) ---------- */
  var heroCard = document.querySelector('.hero-card');
  if(heroCard){
    var dashIO = new IntersectionObserver(function(entries){
      if(!entries[0].isIntersecting) return;
      dashIO.disconnect();
      document.querySelectorAll('.score-fill').forEach(function(f){ f.style.width = f.dataset.w + '%'; });
      document.querySelectorAll('.score-num').forEach(function(n){ countTo(n, +n.dataset.count, 1100); });
      setTimeout(startLiveRow, 2200);
    }, {threshold:.3});
    dashIO.observe(heroCard);
  }
  function startLiveRow(){
    var row = document.getElementById('liveRow');
    if(!row || reduced) return;
    var stage = document.getElementById('liveStage'),
        score = document.getElementById('liveScore'),
        fill  = document.getElementById('liveFill'),
        ticks = document.getElementById('liveTicks'),
        seen  = document.getElementById('liveSeen'),
        up = true;
    setInterval(function(){
      row.classList.add('flash');
      setTimeout(function(){ row.classList.remove('flash'); }, 900);
      if(up){
        countTo(score, 78, 900); fill.style.width = '78%';
        seen.textContent = 'just now';
        setTimeout(function(){
          stage.textContent = 'Conversion ready';
          stage.className = 'stage ready';
          var ghost = ticks.querySelector('.tick.ghost');
          if(ghost){ ghost.className = 'tick'; ghost.textContent = '✓'; ghost.title = 'Upgrade offer'; }
        }, 950);
      } else {
        countTo(score, 64, 900); fill.style.width = '64%';
        seen.textContent = '2m ago';
        stage.textContent = 'Active';
        stage.className = 'stage active';
        var last = ticks.querySelectorAll('.tick')[2];
        if(last){ last.className = 'tick ghost'; last.textContent = '·'; last.removeAttribute('title'); }
      }
      up = !up;
    }, 6000);
  }

  /* ---------- hero side chips ---------- */
  var chips = [].slice.call(document.querySelectorAll('.drift-left .chip'))
        .concat([].slice.call(document.querySelectorAll('.drift-right .chip')));
  if(chips.length && !reduced){
    var ci = 0;
    setInterval(function(){
      chips.forEach(function(c){ c.classList.remove('on'); });
      chips[ci % chips.length].classList.add('on');
      ci++;
    }, 1400);
  }

  /* ---------- pipeline (home) ---------- */
  var pipeCard = document.getElementById('pipeCard');
  if(pipeCard){
    var stages = [
      { pos:0,   score:4,   feed:[
          {t:'identify("maya@lumenapp.io")', m:false},
          {t:'welcome email · sent ✓', m:true} ]},
      { pos:25,  score:23,  feed:[
          {t:'3 sessions · key feature unused', m:false},
          {t:'feature nudge · queued', m:true} ]},
      { pos:50,  score:58,  feed:[
          {t:'feature_used ×4 · 12 pages', m:false},
          {t:'value demo · sent ✓', m:true} ]},
      { pos:75,  score:86,  feed:[
          {t:'pricing_page_visit · upgrade_clicked', m:false},
          {t:'upgrade offer · sent ✓', m:true} ]},
      { pos:100, score:100, feed:[
          {t:'payment_success', m:false},
          {t:'lifecycle emails · stopped', m:true} ]}
    ];
    var walker = document.getElementById('walker'),
        wscore = document.getElementById('wscore'),
        pfill  = document.getElementById('pipeFill'),
        pfeed  = document.getElementById('pipeFeed'),
        pstops = document.querySelectorAll('.pstop'),
        pipeRunning = false;

    var setStage = function(i){
      var s = stages[i];
      walker.style.left = s.pos + '%';
      pfill.style.width = s.pos + '%';
      walker.classList.toggle('paid', i === stages.length-1);
      pstops.forEach(function(st, j){
        st.classList.toggle('done', j <= i);
        st.classList.toggle('now', j === i);
      });
      if(i === stages.length-1){ wscore.textContent = 'paid ✓'; }
      else {
        var m = wscore.textContent.match(/\d+/), from = m ? +m[0] : 0;
        animScore(from, s.score);
      }
      pfeed.innerHTML = '';
      s.feed.forEach(function(f, k){
        var chip = document.createElement('span');
        chip.className = 'feed-chip' + (f.m ? ' mail' : '');
        chip.style.animationDelay = (0.45 + k*0.4) + 's';
        chip.innerHTML = '<span class="cdot"></span>' + f.t;
        pfeed.appendChild(chip);
      });
    };
    var animScore = function(from, to){
      var t0 = null, ms = 800;
      function frame(t){
        if(!t0) t0 = t;
        var p = Math.min((t-t0)/ms,1), eased = 1-Math.pow(1-p,3);
        wscore.textContent = 'score ' + Math.round(from+(to-from)*eased);
        if(p<1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    };
    var runPipe = function(){
      if(pipeRunning) return;
      pipeRunning = true;
      if(reduced){ setStage(stages.length-1); return; }
      var i = 0;
      setStage(0);
      setInterval(function(){
        i = (i+1) % (stages.length+1);
        if(i === stages.length){
          walker.style.transition = 'none'; pfill.style.transition = 'none';
          i = 0; setStage(0);
          void walker.offsetWidth;
          walker.style.transition = ''; pfill.style.transition = '';
        } else { setStage(i); }
      }, 2600);
    };
    var pipeIO = new IntersectionObserver(function(entries){
      if(entries[0].isIntersecting){ runPipe(); pipeIO.disconnect(); }
    }, {threshold:.35});
    pipeIO.observe(pipeCard);
  }

  /* ---------- bento score layers ---------- */
  var layersEl = document.querySelector('.layers');
  if(layersEl){
    var layIO = new IntersectionObserver(function(entries){
      if(!entries[0].isIntersecting) return;
      layIO.disconnect();
      layersEl.querySelectorAll('.lfill').forEach(function(f, idx){
        setTimeout(function(){ f.style.width = f.dataset.w + '%'; }, idx*90);
      });
    }, {threshold:.4});
    layIO.observe(layersEl);
  }

  /* ---------- faq accordion ---------- */
  document.querySelectorAll('.faq-item button').forEach(function(btn){
    btn.addEventListener('click', function(){
      var item = btn.parentElement, open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function(o){
        o.classList.remove('open');
        o.querySelector('button').setAttribute('aria-expanded','false');
      });
      if(!open){ item.classList.add('open'); btn.setAttribute('aria-expanded','true'); }
    });
  });

  /* ---------- workflow comparison (compare hub) ---------- */
  var wfGrid = document.getElementById('wfGrid');
  if(wfGrid){
    var wfCols = 5,
        wfStep = -1,
        wfTimer = null,
        wfPaused = false,
        wfBar = document.querySelector('.wf-progress i'),
        wfPlay = document.getElementById('wfPlay'),
        wfVerdicts = [
          'Day 0 — both tools send a welcome. So far, identical.',
          'Day 1 — the timer tool is silent by design. ConversionCRM is silent by <b>decision</b>: score 58, stage Active, no email needed.',
          'Day 2 — she reads pricing twice. The drip can’t see it. ConversionCRM flags <b>buying intent</b> and sends the upgrade offer that night.',
          'Day 4 — she goes quiet. The drip mails a case study to nobody. ConversionCRM switches to a <b>check-in</b>, because the stage changed.',
          'Day 7 — she’s back and hits her usage limit. The journey already ended. ConversionCRM sends the <b>limit upgrade email</b> — and she converts.'
        ],
        wfVerdictEl = document.getElementById('wfVerdict');

    function wfAdvance(){
      wfStep++;
      if(wfStep >= wfCols){
        wfStep = -1;
        wfGrid.querySelectorAll('.wf-cell').forEach(function(c){ c.classList.remove('on'); });
        if(wfBar){ wfBar.style.transition='none'; wfBar.style.width='0'; void wfBar.offsetWidth; wfBar.style.transition=''; }
        if(wfVerdictEl) wfVerdictEl.innerHTML = 'Watching one user, day by day…';
        return;
      }
      wfGrid.querySelectorAll('[data-col="'+wfStep+'"]').forEach(function(c){ c.classList.add('on'); });
      if(wfBar) wfBar.style.width = ((wfStep+1)/wfCols*100) + '%';
      if(wfVerdictEl) wfVerdictEl.innerHTML = wfVerdicts[wfStep];
    }
    function wfStart(){
      if(wfTimer) return;
      wfAdvance();
      wfTimer = setInterval(function(){ if(!wfPaused) wfAdvance(); }, 2400);
    }
    if(reduced){
      wfGrid.querySelectorAll('.wf-cell').forEach(function(c){ c.classList.add('on'); });
      if(wfVerdictEl) wfVerdictEl.innerHTML = wfVerdicts[wfVerdicts.length-1];
    } else {
      var wfIO = new IntersectionObserver(function(entries){
        if(entries[0].isIntersecting){ wfStart(); wfIO.disconnect(); }
      }, {threshold:.3});
      wfIO.observe(wfGrid);
      if(wfPlay){
        wfPlay.addEventListener('click', function(){
          wfPaused = !wfPaused;
          wfPlay.innerHTML = wfPaused
            ? '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.5 L10.5 6 L3 10.5 Z" fill="currentColor"/></svg>'
            : '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="1.5" width="2.6" height="9" rx="1" fill="currentColor"/><rect x="7.4" y="1.5" width="2.6" height="9" rx="1" fill="currentColor"/></svg>';
          wfPlay.setAttribute('aria-label', wfPaused ? 'Play' : 'Pause');
        });
      }
    }
  }

  /* ---------- blog motion scenes ---------- */
  document.querySelectorAll('.scene').forEach(function(scene){
    var caps = scene.querySelectorAll('.scene-caps span');
    if(!caps.length) return;
    var dotsWrap = scene.querySelector('.scene-dots'),
        n = caps.length, i = 0, hover = false, timer = null;
    if(dotsWrap){
      for(var d=0; d<n; d++){
        var dot = document.createElement('i');
        (function(idx, el){ el.addEventListener('click', function(){ show(idx); }); })(d, dot);
        dotsWrap.appendChild(dot);
      }
    }
    var dots = dotsWrap ? dotsWrap.querySelectorAll('i') : [];
    function show(idx){
      i = idx;
      scene.setAttribute('data-step', i);
      caps.forEach(function(c, k){ c.classList.toggle('on', k===i); });
      dots.forEach(function(dt, k){ dt.classList.toggle('on', k===i); });
    }
    show(0);
    if(reduced) return;
    scene.addEventListener('mouseenter', function(){ hover = true; });
    scene.addEventListener('mouseleave', function(){ hover = false; });
    var sceneIO = new IntersectionObserver(function(entries){
      if(entries[0].isIntersecting && !timer){
        timer = setInterval(function(){ if(!hover) show((i+1)%n); }, 3200);
      } else if(!entries[0].isIntersecting && timer){
        clearInterval(timer); timer = null;
      }
    }, {threshold:.3});
    sceneIO.observe(scene);
  });
})();
