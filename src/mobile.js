/* VisualViewport follows the keyboard on Safari and Chrome without disabling pinch zoom. */
(()=>{
 const viewport=window.visualViewport,root=document.documentElement;
 let frame=0;
 function update(){
  frame=0;
  if(viewport&&Math.abs(viewport.scale-1)>0.05)return;
  const height=viewport?.height||innerHeight,top=viewport?.offsetTop||0;
  root.style.setProperty('--visual-height',Math.round(height)+'px');
  root.style.setProperty('--visual-top',Math.round(top)+'px');
  const editing=document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable=true]');
  document.body.classList.toggle('keyboard-open',!!editing&&innerHeight-height>140);
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(update);}
 viewport?.addEventListener('resize',schedule,{passive:true});
 viewport?.addEventListener('scroll',schedule,{passive:true});
 window.addEventListener('resize',schedule,{passive:true});
 document.addEventListener('focusin',schedule);
 document.addEventListener('focusout',schedule);
 update();
})();
