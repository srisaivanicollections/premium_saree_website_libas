(function(){
  "use strict";
  if(window.__SSV_SMART_FINDER_INIT__) return;
  window.__SSV_SMART_FINDER_INIT__=true;
  const $=(selector,root=document)=>root.querySelector(selector);
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  let catalogue=[],loaded=false,loadPromise=null,lastFocus=null,backgroundState=[],preferences={category:"Sarees",budget:"",color:""},allMatches=[],shownCount=0,shopSettings={},quickFilter="";
  const money=value=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(value));
  function shell(){
    if($("#ssv-smart-finder-trigger"))return;
    const trigger=document.createElement("button");
    trigger.type="button";trigger.id="ssv-smart-finder-trigger";trigger.className="ssv-finder-trigger";
    trigger.setAttribute("aria-label","Find My Style");trigger.setAttribute("aria-controls","ssv-smart-finder-panel");trigger.setAttribute("aria-expanded","false");
    trigger.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l1.8 6.1 6.1 1.8-6.1 1.8-1.8 6.1-1.8-6.1-6.1-1.8 6.1-1.8z"/><path d="M19 15.5l.8 2.7 2.7.8-2.7.8-.8 2.7-.8-2.7-2.7-.8 2.7-.8z"/></svg><span class="ssv-finder-trigger-label">Find My Style</span>';
    const panel=document.createElement("section");
    panel.id="ssv-smart-finder-panel";panel.className="ssv-finder-panel";panel.hidden=true;panel.tabIndex=-1;panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");panel.setAttribute("aria-labelledby","ssv-finder-heading");
    panel.innerHTML='<header class="ssv-finder-head"><h2 class="ssv-finder-title" id="ssv-finder-heading"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l1.8 6.1 6.1 1.8-6.1 1.8-1.8 6.1-1.8-6.1-6.1-1.8 6.1-1.8z"/></svg>Find My Style</h2><button type="button" class="ssv-finder-close" aria-label="Close Find My Style">×</button></header><p class="ssv-finder-intro" id="ssv-finder-intro">Choose a category and budget. Sarees and dresses can also be filtered by recorded colour.</p><form id="ssv-finder-form"><div class="ssv-finder-fields"><div class="ssv-finder-field"><label for="ssv-finder-category">What are you shopping for?</label><select id="ssv-finder-category" name="category"><option value="Sarees">Sarees</option><option value="Dresses">Dresses</option><option value="Jewellery">Jewellery</option></select></div><div class="ssv-finder-field"><label for="ssv-finder-budget">Your maximum budget in ₹ (optional)</label><input id="ssv-finder-budget" name="budget" type="number" min="0" step="100" inputmode="numeric" placeholder="Any budget" autocomplete="off"></div><div class="ssv-finder-field" id="ssv-finder-color-field"><label for="ssv-finder-color">Preferred colour (optional)</label><select id="ssv-finder-color" name="color"><option value="">Any colour</option></select></div></div><div class="ssv-finder-actions"><button type="button" class="ssv-finder-reset" id="ssv-finder-reset">Reset</button><button type="submit" class="ssv-finder-submit">Find Matches</button></div></form><p class="ssv-finder-message" id="ssv-finder-message" role="status" aria-live="polite"></p><div class="ssv-finder-results" id="ssv-finder-results"></div><p class="ssv-finder-note">Colour matches use recorded product details only. We do not guess missing product attributes.</p>';
    document.body.append(trigger,panel);
    trigger.addEventListener("click",()=>{lastFocus=document.activeElement;setBackgroundInert(panel,true);panel.hidden=false;trigger.hidden=true;trigger.setAttribute("aria-expanded","true");$("#ssv-finder-category").focus();loadCatalogue();});
    $("#ssv-finder-category",panel).addEventListener("change",()=>{preferences.category=$("#ssv-finder-category").value;preferences.color="";quickFilter="";$("#ssv-finder-color").value="";syncColorField();populateColors();$("#ssv-finder-results").replaceChildren();$("#ssv-finder-intro").textContent=["jewellery","jewelry"].includes(preferences.category.toLowerCase())?"Choose your budget to find gold jewellery. No colour selection is needed.":"Choose a budget and, if you like, a recorded colour.";$("#ssv-finder-message").textContent="Category updated. Choose your preferences and find matching products.";});
    $(".ssv-finder-close",panel).addEventListener("click",closePanel);
    $("#ssv-finder-form",panel).addEventListener("submit",async event=>{event.preventDefault();const submit=$("#ssv-finder-form .ssv-finder-submit",panel);submit.disabled=true;try{await loadCatalogue();if(!loaded)return;readPreferences();quickFilter="";recommend();}finally{submit.disabled=false;}});
    $("#ssv-finder-reset",panel).addEventListener("click",()=>{preferences={category:"Sarees",budget:"",color:""};quickFilter="";$("#ssv-finder-form").reset();$("#ssv-finder-intro").textContent="Choose a category and budget. Sarees and dresses can also be filtered by recorded colour.";syncColorField();populateColors();$("#ssv-finder-results").replaceChildren();$("#ssv-finder-message").textContent="Preferences cleared. Choose what matters to you.";});
    document.addEventListener("keydown",event=>{
      if(panel.hidden)return;
      if(event.key==="Escape"){event.preventDefault();closePanel();return;}
      if(event.key!=="Tab")return;
      const focusable=[...panel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
        .filter(element=>!element.hidden&&element.getAttribute("aria-hidden")!=="true"&&element.getClientRects().length>0);
      if(!focusable.length){event.preventDefault();panel.focus();return;}
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first.focus();}
    });
  }
  function closePanel(){const panel=$("#ssv-smart-finder-panel"),trigger=$("#ssv-smart-finder-trigger");if(!panel||!trigger)return;panel.hidden=true;setBackgroundInert(panel,false);trigger.hidden=false;trigger.setAttribute("aria-expanded","false");(lastFocus&&lastFocus.isConnected?lastFocus:trigger).focus();}
  function setBackgroundInert(panel,enabled){
    if(enabled){
      backgroundState=[];
      [...document.body.children].filter(element=>element!==panel&&!element.contains(panel)).forEach(element=>{
        backgroundState.push({element,inert:element.inert,ariaHidden:element.getAttribute("aria-hidden")});
        element.inert=true;
      });
      return;
    }
    backgroundState.forEach(({element,inert,ariaHidden})=>{
      if(!element.isConnected)return;
      element.inert=inert;
      if(ariaHidden===null)element.removeAttribute("aria-hidden");else element.setAttribute("aria-hidden",ariaHidden);
    });
    backgroundState=[];
  }
  function loadCatalogue(){
    if(loaded){populateColors();return Promise.resolve(true);}
    if(loadPromise)return loadPromise;
    const message=$("#ssv-finder-message");
    const submit=$("#ssv-finder-form .ssv-finder-submit");
    message.textContent="Loading current collection…";
    loadPromise=(async()=>{
      try{
        const response=await fetch("./data/products.json?finder="+Date.now(),{cache:"no-store",headers:{Accept:"application/json"}});
        if(!response.ok)throw new Error("Catalogue request failed ("+response.status+").");
        const data=await response.json();if(!Array.isArray(data))throw new Error("Catalogue format is not valid.");
        catalogue=data.filter(p=>p&&["sarees","dresses","jewelry","jewellery"].includes(String(p.category||"").trim().toLowerCase())&&Number.isFinite(Number(p.price))&&Number(p.price)>=0);
        try{const settingsResponse=await fetch("./data/settings.json?finder="+Date.now(),{cache:"no-store",headers:{Accept:"application/json"}});if(settingsResponse.ok){const settings=await settingsResponse.json();if(settings&&typeof settings==="object")shopSettings=settings;}}catch(_){shopSettings={};}
        loaded=true;populateColors();
        message.textContent=catalogue.length?"Choose your category and preferences, then find matching products.":"No supported products are currently available in the catalogue.";
        return true;
      }catch(error){
        loadPromise=null;
        message.textContent="The finder could not load the catalogue. Please try again.";
        return false;
      }finally{
        if(submit)submit.disabled=false;
      }
    })();
    return loadPromise;
  }
  function syncColorField(){
    const field=$("#ssv-finder-color-field"),select=$("#ssv-finder-color");
    const category=$("#ssv-finder-category")?.value||"Sarees";
    const jewellery=["jewellery","jewelry"].includes(category.trim().toLowerCase());
    if(field){field.hidden=jewellery;field.style.display=jewellery?"none":"";}
    if(jewellery&&select)select.value="";
    if(jewellery)preferences.color="";
  }
  function populateColors(){
    const select=$("#ssv-finder-color");if(!select)return;
    const current=select.value;
    const category=$("#ssv-finder-category")?.value||"Sarees";
    const jewellery=["jewellery","jewelry"].includes(category.trim().toLowerCase());
    syncColorField();
    const colors=jewellery?[]:[...new Map(catalogue.filter(p=>String(p.category||"").trim().toLowerCase()===category.toLowerCase()).map(p=>String(p.color||"").trim()).filter(Boolean).map(color=>[color.toLocaleLowerCase(),color])).values()].sort((a,b)=>a.localeCompare(b));
    select.innerHTML='<option value="">'+(colors.length?"Any colour":"Any colour (no recorded colours)")+'</option>'+colors.map(color=>'<option value="'+esc(color)+'">'+esc(color)+'</option>').join("");
    if(!jewellery&&colors.some(color=>color.toLowerCase()===current.toLowerCase()))select.value=colors.find(color=>color.toLowerCase()===current.toLowerCase())||"";
    if(jewellery)select.value="";
  }
  function readPreferences(){const form=$("#ssv-finder-form");const category=form.elements.category.value;preferences={category,budget:form.elements.budget.value,color:["jewellery","jewelry"].includes(category.trim().toLowerCase())?"":form.elements.color.value};}
  function isAvailable(p){if(p.availability===false||p.inStock===false||p.outOfStock===true)return false;return p.availability===true||p.inStock===true;}
  function navigateToProduct(product,addToBag=false){
    const category=String(product.category||preferences.category||"Sarees");
    const targetName=String(product.name||"");
    closePanel();
    const grid=$("#products");
    if(!grid||!targetName)return;
    const categoryTab=[...document.querySelectorAll("[data-tab]")].find(tab=>tab.dataset.tab===category);
    if(categoryTab)categoryTab.click();
    const search=$("#search")||$("#shop .lux-search input");
    if(search&&search.value){search.value="";search.dispatchEvent(new Event("input",{bubbles:true}));}
    const findTarget=()=>[...grid.querySelectorAll("img[alt]")].find(img=>img.alt===targetName);
    let image=findTarget();
    if(!image){if($("#shop"))$("#shop").scrollIntoView({behavior:"auto",block:"start"});return;}
    const item=image.closest(".lux-item-card,.product-card,article")||image;
    if(addToBag){
      const addButton=item.querySelector("[data-add-cart],.ssv-add-cart");
      if(addButton){addButton.click();return;}
    }
    item.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});
    item.setAttribute("tabindex","-1");item.focus({preventScroll:true});
  }
  function helpUrl(product){
    const phone=String(shopSettings.whatsapp||"").replace(/\D/g,"");
    if(!phone)return "";
    const message=product
      ?"Hi Sri Sai Vani Collections! I’m interested in "+String(product.name||"this product")+" priced at "+money(product.price)+". Could you please help me with the details?"
      :"Hi Sri Sai Vani Collections! I need help choosing a style. Could you please suggest some options?";
    return "https://wa.me/"+phone+"?text="+encodeURIComponent(message);
  }
  function renderMatches(){
    const resultBox=$("#ssv-finder-results"),message=$("#ssv-finder-message");
    resultBox.replaceChildren();
    const category=preferences.category||"Sarees";
    const categoryLabel=["jewellery","jewelry"].includes(category.toLowerCase())?"jewellery":category.toLowerCase();
    const results=allMatches.slice(0,shownCount);
    if(!results.length){
      const jewellery=["jewellery","jewelry"].includes(category.toLowerCase());
      message.textContent="We couldn’t find an exact match for your preferences. "+(jewellery?"Try adjusting your budget or browse the jewellery collection.":"Try changing your budget or colour, or browse the full collection.") ;
      const recovery=document.createElement("div");recovery.className="ssv-finder-recovery";
      recovery.innerHTML='<button type="button" class="ssv-finder-recovery-action" data-recovery="budget">Edit Budget</button>'+(!jewellery?'<button type="button" class="ssv-finder-recovery-action" data-recovery="color">Change Colour</button>':"")+'<button type="button" class="ssv-finder-recovery-action" data-recovery="all">Browse All</button>';
      recovery.querySelector('[data-recovery="budget"]').addEventListener("click",()=>{$("#ssv-finder-budget").focus();$("#ssv-finder-budget").scrollIntoView({block:"center",behavior:"smooth"});});
      const colorAction=recovery.querySelector('[data-recovery="color"]');
      if(colorAction)colorAction.addEventListener("click",()=>{$("#ssv-finder-color").value="";readPreferences();preferences.color="";$("#ssv-finder-color").value="";recommend();});
      recovery.querySelector('[data-recovery="all"]').addEventListener("click",()=>{closePanel();const allTab=[...document.querySelectorAll("[data-tab]")].find(tab=>tab.dataset.tab==="All");if(allTab)allTab.click();const search=$("#search")||$("#shop .lux-search input");if(search&&search.value){search.value="";search.dispatchEvent(new Event("input",{bubbles:true}));}if($("#shop"))$("#shop").scrollIntoView({behavior:"auto",block:"start"});});
      resultBox.append(recovery);
      const help=helpUrl();
      if(help){const link=document.createElement("a");link.className="ssv-finder-help";link.href=help;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Need help choosing? Chat with us on WhatsApp";resultBox.append(link);}
      return;
    }
    message.textContent="We found "+allMatches.length+" matching "+categoryLabel+(allMatches.length===1?" option.":" options.")+" Showing "+Math.min(shownCount,allMatches.length)+" of "+allMatches.length+".";
    const heading=document.createElement("p");heading.className="ssv-finder-recommendation-heading";heading.textContent=quickFilter==="newArrival"?"New Arrivals":quickFilter==="bestSeller"?"Best Sellers":"Recommended for You";resultBox.append(heading);
    results.forEach((product,index)=>{
      const image=String(product.image||"").replace(/^\.\//,"");
      const imageUrl=/^https?:\/\//i.test(image)?image:"./"+image.replace(/^\//,"");
      const originalPrice=Number(product.originalPrice);
      const hasOriginalPrice=Number.isFinite(originalPrice)&&originalPrice>Number(product.price);
      const badges=[];
      if(product.bestSeller===true)badges.push("Best Seller");
      if(product.newArrival===true)badges.push("New Arrival");
      const details=[product.color?"Recorded colour: "+String(product.color).trim():"","In stock"].filter(Boolean).join(" · ");
      const card=document.createElement("article");card.className="ssv-finder-result";
      card.innerHTML='<img loading="lazy" src="'+esc(imageUrl)+'" alt="'+esc(product.name||categoryLabel)+'"><div class="ssv-finder-result-copy">'+(index===0?'<span class="ssv-finder-match-label">Best Match</span>':"")+'<h3>'+esc(product.name||categoryLabel)+'</h3><p class="ssv-finder-price">'+money(product.price)+(hasOriginalPrice?' <del class="ssv-finder-original">'+money(originalPrice)+'</del>':"")+'</p>'+(badges.length?'<p class="ssv-finder-badges">'+badges.map(badge=>'<span>'+esc(badge)+'</span>').join("")+'</p>':"")+'<p class="ssv-finder-meta">'+esc(details)+'</p><div class="ssv-finder-product-actions"><button type="button" class="ssv-finder-view">View Product</button><button type="button" class="ssv-finder-add">Add to Bag</button></div></div>';
      $(".ssv-finder-view",card).addEventListener("click",()=>navigateToProduct(product,false));
      $(".ssv-finder-add",card).addEventListener("click",()=>{
        const targetName=String(product.name||"");
        const grid=$("#products");
        const categoryTab=[...document.querySelectorAll("[data-tab]")].find(tab=>tab.dataset.tab===String(product.category||preferences.category));
        if(categoryTab)categoryTab.click();
        const search=$("#search")||$("#shop .lux-search input");
        if(search&&search.value){search.value="";search.dispatchEvent(new Event("input",{bubbles:true}));}
        const image=grid&&[...grid.querySelectorAll("img[alt]")].find(img=>img.alt===targetName);
        const item=image&&(image.closest(".lux-item-card,.product-card,article")||image);
        const addButton=item&&item.querySelector("[data-add-cart],.ssv-add-cart");
        if(addButton){closePanel();addButton.click();return;}
        $("#ssv-finder-message").textContent="We couldn’t add this item directly. Choose View Product to find it in the collection.";
      });
      const productHelp=helpUrl(product);
      if(productHelp){const link=document.createElement("a");link.className="ssv-finder-help ssv-finder-product-help";link.href=productHelp;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Ask about this item";$(".ssv-finder-result-copy",card).append(link);}
      const img=$("img",card);img.addEventListener("error",()=>{img.hidden=true;},{once:true});
      resultBox.append(card);
    });
    if(shownCount<allMatches.length){
      const more=document.createElement("button");more.type="button";more.className="ssv-finder-more";more.textContent="Show More Matches";
      more.addEventListener("click",()=>{shownCount=Math.min(shownCount+3,allMatches.length);renderMatches();});
      resultBox.append(more);
    }
    const controls=document.createElement("div");controls.className="ssv-finder-result-footer";
    const change=document.createElement("button");change.type="button";change.className="ssv-finder-recovery-action";change.textContent="Change Preferences";
    change.addEventListener("click",()=>{$("#ssv-finder-budget").focus();$("#ssv-finder-form").scrollIntoView({block:"start",behavior:"smooth"});});
    controls.append(change);
    const arrivals=document.createElement("button");arrivals.type="button";arrivals.className="ssv-finder-recovery-action";arrivals.textContent="New Arrivals";arrivals.addEventListener("click",()=>{quickFilter="newArrival";recommend();});controls.append(arrivals);
    const bestSellers=document.createElement("button");bestSellers.type="button";bestSellers.className="ssv-finder-recovery-action";bestSellers.textContent="Best Sellers";bestSellers.addEventListener("click",()=>{quickFilter="bestSeller";recommend();});controls.append(bestSellers);
    const genericHelp=helpUrl();
    if(genericHelp){const link=document.createElement("a");link.className="ssv-finder-help";link.href=genericHelp;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Need Help Choosing? WhatsApp Us";controls.append(link);}
    resultBox.append(controls);
  }
  function recommend(){
    const message=$("#ssv-finder-message");
    const category=preferences.category||"Sarees";
    allMatches=catalogue.filter(p=>String(p.category||"").trim().toLowerCase()===category.toLowerCase()).filter(p=>isAvailable(p));
    if(quickFilter==="newArrival")allMatches=allMatches.filter(p=>p.newArrival===true);
    if(quickFilter==="bestSeller")allMatches=allMatches.filter(p=>p.bestSeller===true);
    if(preferences.budget!==""){
      const budget=Number(preferences.budget);
      if(!Number.isFinite(budget)||budget<0){allMatches=[];shownCount=3;renderMatches();return;}
      allMatches=allMatches.filter(p=>Number(p.price)<=budget);
    }
    if(preferences.color&& !["jewellery","jewelry"].includes(category.trim().toLowerCase()))allMatches=allMatches.filter(p=>String(p.color||"").trim().toLowerCase()===preferences.color.toLowerCase());
    allMatches.sort((a,b)=>{
      const best=Number(Boolean(b.bestSeller))-Number(Boolean(a.bestSeller));
      if(best)return best;
      const fresh=Number(Boolean(b.newArrival))-Number(Boolean(a.newArrival));
      if(fresh)return fresh;
      return Number(a.price)-Number(b.price);
    });
    shownCount=Math.min(3,allMatches.length);
    if(!allMatches.length)message.textContent="";
    renderMatches();
  }
  function start(){try{shell();}catch(error){console.error("Smart Saree Finder could not initialize.",error);}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();