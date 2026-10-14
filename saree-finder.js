(function(){
  "use strict";
  if(window.__SSV_SMART_FINDER_INIT__) return;
  window.__SSV_SMART_FINDER_INIT__=true;
  const $=(selector,root=document)=>root.querySelector(selector);
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  let catalogue=[],loaded=false,lastFocus=null,preferences={budget:"",color:"",priority:"any",count:"3"};
  const money=value=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(value));
  function shell(){
    if($("#ssv-smart-finder-trigger"))return;
    const trigger=document.createElement("button");
    trigger.type="button";trigger.id="ssv-smart-finder-trigger";trigger.className="ssv-finder-trigger";
    trigger.setAttribute("aria-label","Find My Saree");trigger.setAttribute("aria-controls","ssv-smart-finder-panel");trigger.setAttribute("aria-expanded","false");
    trigger.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l1.8 6.1 6.1 1.8-6.1 1.8-1.8 6.1-1.8-6.1-6.1-1.8 6.1-1.8z"/><path d="M19 15.5l.8 2.7 2.7.8-2.7.8-.8 2.7-.8-2.7-2.7-.8 2.7-.8z"/></svg><span class="ssv-finder-trigger-label">Find My Saree</span>';
    const panel=document.createElement("section");
    panel.id="ssv-smart-finder-panel";panel.className="ssv-finder-panel";panel.hidden=true;panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","false");panel.setAttribute("aria-labelledby","ssv-finder-heading");
    panel.innerHTML='<header class="ssv-finder-head"><h2 class="ssv-finder-title" id="ssv-finder-heading"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l1.8 6.1 6.1 1.8-6.1 1.8-1.8 6.1-1.8-6.1-6.1-1.8 6.1-1.8z"/></svg>Find My Saree</h2><button type="button" class="ssv-finder-close" aria-label="Close Find My Saree">×</button></header><p class="ssv-finder-intro">A few preferences will help us find options from our current collection.</p><form id="ssv-finder-form"><div class="ssv-finder-fields"><div class="ssv-finder-field"><label for="ssv-finder-budget">Your maximum budget in ₹ (optional)</label><input id="ssv-finder-budget" name="budget" type="number" min="0" step="100" inputmode="numeric" placeholder="Any budget" autocomplete="off"></div><div class="ssv-finder-field"><label for="ssv-finder-color">Preferred colour (from recorded catalogue data)</label><select id="ssv-finder-color" name="color"><option value="">Any recorded colour</option></select></div><div class="ssv-finder-field"><label for="ssv-finder-priority">What would you like to see first?</label><select id="ssv-finder-priority" name="priority"><option value="any">A mix of sarees</option><option value="bestSeller">Best sellers first</option><option value="newArrival">New arrivals first</option></select></div><div class="ssv-finder-field"><label for="ssv-finder-count">How many options?</label><select id="ssv-finder-count" name="count"><option value="1">Just one</option><option value="3" selected>Up to 3 options</option></select></div></div><div class="ssv-finder-actions"><button type="button" class="ssv-finder-reset" id="ssv-finder-reset">Reset</button><button type="submit" class="ssv-finder-submit">Show My Sarees</button></div></form><p class="ssv-finder-message" id="ssv-finder-message" role="status" aria-live="polite"></p><div class="ssv-finder-results" id="ssv-finder-results"></div><p class="ssv-finder-note">Colour matches use recorded product details only. Occasion and fabric are not inferred.</p>';
    document.body.append(trigger,panel);
    trigger.addEventListener("click",()=>{lastFocus=document.activeElement;panel.hidden=false;trigger.hidden=true;trigger.setAttribute("aria-expanded","true");$("#ssv-finder-budget").focus();loadCatalogue();});
    $(".ssv-finder-close",panel).addEventListener("click",closePanel);
    $("#ssv-finder-form",panel).addEventListener("submit",event=>{event.preventDefault();readPreferences();recommend();});
    $("#ssv-finder-reset",panel).addEventListener("click",()=>{preferences={budget:"",color:"",priority:"any",count:"3"};$("#ssv-finder-form").reset();$("#ssv-finder-count").value="3";$("#ssv-finder-results").replaceChildren();$("#ssv-finder-message").textContent="Preferences cleared. Choose what matters to you.";});
    document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!panel.hidden){event.preventDefault();closePanel();}});
  }
  function closePanel(){const panel=$("#ssv-smart-finder-panel"),trigger=$("#ssv-smart-finder-trigger");if(!panel||!trigger)return;panel.hidden=true;trigger.hidden=false;trigger.setAttribute("aria-expanded","false");(lastFocus&&lastFocus.isConnected?lastFocus:trigger).focus();}
  async function loadCatalogue(){
    if(loaded){populateColors();return;}
    const message=$("#ssv-finder-message");message.textContent="Loading current collection…";
    try{
      const response=await fetch("./data/products.json?finder="+Date.now(),{cache:"no-store",headers:{Accept:"application/json"}});
      if(!response.ok)throw new Error("Catalogue request failed ("+response.status+").");
      const data=await response.json();if(!Array.isArray(data))throw new Error("Catalogue format is not valid.");
      catalogue=data.filter(p=>p&&String(p.category||"").toLowerCase()==="sarees"&&Number.isFinite(Number(p.price))&&Number(p.price)>=0);
      loaded=true;populateColors();message.textContent=catalogue.length?"Choose any preferences, then show matching sarees.":"No saree products are currently available in the catalogue.";
    }catch(error){message.textContent="The finder could not load the catalogue. Your normal shopping page is still available. Please close this panel and try again.";}
  }
  function populateColors(){
    const select=$("#ssv-finder-color");if(!select)return;const current=select.value;
    const colors=[...new Set(catalogue.map(p=>String(p.color||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    select.innerHTML='<option value="">Any recorded colour</option>'+colors.map(color=>'<option value="'+esc(color)+'">'+esc(color)+'</option>').join("");
    if(colors.includes(current))select.value=current;
  }
  function readPreferences(){const form=$("#ssv-finder-form");preferences={budget:form.elements.budget.value,color:form.elements.color.value,priority:form.elements.priority.value,count:form.elements.count.value};}
  function isAvailable(p){if(p.availability===false||p.inStock===false||p.outOfStock===true)return false;return p.availability===true||p.inStock===true;}
  function recommend(){
    const resultBox=$("#ssv-finder-results"),message=$("#ssv-finder-message");resultBox.replaceChildren();
    let matches=catalogue.filter(p=>isAvailable(p));
    if(preferences.budget!=="")matches=matches.filter(p=>Number(p.price)<=Number(preferences.budget));
    if(preferences.color)matches=matches.filter(p=>String(p.color||"").trim().toLowerCase()===preferences.color.toLowerCase());
    matches.sort((a,b)=>{
      const signal=preferences.priority==="bestSeller"?(Number(Boolean(b.bestSeller))-Number(Boolean(a.bestSeller))):preferences.priority==="newArrival"?(Number(Boolean(b.newArrival))-Number(Boolean(a.newArrival))):0;
      if(signal)return signal;
      if(preferences.priority==="any"){const best=Number(Boolean(b.bestSeller))-Number(Boolean(a.bestSeller));if(best)return best;const fresh=Number(Boolean(b.newArrival))-Number(Boolean(a.newArrival));if(fresh)return fresh;}
      return Number(a.price)-Number(b.price);
    });
    const requestedCount=Number(preferences.count)||3;\n    const results=matches.slice(0,Math.min(3,requestedCount));
    if(!results.length){message.textContent="No verified in-stock sarees match those choices. Try a higher budget or clear the colour preference. Your stated budget will never be exceeded.";return;}
    message.textContent="Found "+matches.length+" matching "+(matches.length===1?"saree":"sarees")+". Showing "+results.length+".";
    results.forEach(product=>{
      const image=String(product.image||"").replace(/^\.\//,"");
      const imageUrl=/^https?:\/\//i.test(image)?image:"./"+image.replace(/^\//,"");
      const originalPrice=Number(product.originalPrice);
      const hasOriginalPrice=Number.isFinite(originalPrice)&&originalPrice>Number(product.price);
      const badges=[];
      if(product.bestSeller===true)badges.push("Best Seller");
      if(product.newArrival===true)badges.push("New Arrival");
      const details=[product.color?"Recorded colour: "+String(product.color).trim():"","In stock"].filter(Boolean).join(" · ");
      const card=document.createElement("article");card.className="ssv-finder-result";
      card.innerHTML='<img loading="lazy" src="'+esc(imageUrl)+'" alt="'+esc(product.name||"Saree")+'"><div><h3>'+esc(product.name||"Saree")+'</h3><p class="ssv-finder-price">'+money(product.price)+(hasOriginalPrice?' <del class="ssv-finder-original">'+money(originalPrice)+'</del>':"")+'</p>'+(badges.length?'<p class="ssv-finder-badges">'+badges.map(badge=>'<span>'+esc(badge)+'</span>').join("")+'</p>':"")+'<p class="ssv-finder-meta">'+esc(details)+'</p><button type="button" class="ssv-finder-view">Browse collection</button></div>';
      $(".ssv-finder-view",card).addEventListener("click",()=>{
        closePanel();
        const grid=$("#products");if(!grid)return;
        const target=[...grid.querySelectorAll("img[alt]")].find(img=>img.alt===String(product.name||""));
        if(target){const item=target.closest(".lux-item-card,.product-card,article")||target;item.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});item.setAttribute("tabindex","-1");item.focus({preventScroll:true});}
        else if($("#shop"))$("#shop").scrollIntoView({behavior:"smooth",block:"start"});
      });
      const img=$("img",card);img.addEventListener("error",()=>{img.hidden=true;},{once:true});
      resultBox.append(card);
    });
  }
  function start(){try{shell();}catch(error){console.error("Smart Saree Finder could not initialize.",error);}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();