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
    panel.innerHTML='<header class="ssv-finder-head"><h2 class="ssv-finder-title" id="ssv-finder-heading"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l1.8 6.1 6.1 1.8-6.1 1.8-1.8 6.1-1.8-6.1-6.1-1.8 6.1-1.8z"/></svg>Find My Style</h2><button type="button" class="ssv-finder-close" aria-label="Close Find My Style">×</button></header><p class="ssv-finder-intro" id="ssv-finder-intro">Choose a category, budget and optional occasion. Sarees and dresses can also be filtered by recorded colour.</p><form id="ssv-finder-form"><div class="ssv-finder-fields"><div class="ssv-finder-field"><label for="ssv-finder-category">What are you shopping for?</label><select id="ssv-finder-category" name="category"><option value="Sarees">Sarees</option><option value="Dresses">Dresses</option><option value="Jewellery">Jewellery</option></select></div><div class="ssv-finder-field"><label for="ssv-finder-budget">Your maximum budget in ₹ (optional)</label><input id="ssv-finder-budget" name="budget" type="number" min="0" step="100" inputmode="numeric" placeholder="Any budget" autocomplete="off"></div><div class="ssv-finder-field" id="ssv-finder-color-field"><label for="ssv-finder-color">Preferred colour (optional)</label><select id="ssv-finder-color" name="color"><option value="">Any colour</option></select></div><div class="ssv-finder-field"><label for="ssv-finder-occasion">Occasion (optional)</label><select id="ssv-finder-occasion" name="occasion"><option value="">Any occasion</option><option value="Daily Wear">Daily wear</option><option value="Wedding">Wedding</option><option value="Festive">Festive</option><option value="Party Wear">Party wear</option><option value="Traditional">Traditional</option></select></div></div><div class="ssv-finder-actions"><button type="button" class="ssv-finder-reset" id="ssv-finder-reset">Reset</button><button type="submit" class="ssv-finder-submit">Find Matches</button></div></form><p class="ssv-finder-message" id="ssv-finder-message" role="status" aria-live="polite"></p><div class="ssv-finder-results" id="ssv-finder-results"></div><p class="ssv-finder-note">Colour uses recorded product details. Occasion uses Admin tags first, then free browser-based image analysis for untagged products, with keyword fallback if AI is unavailable. The first AI scan may download a large model; your product images are analysed in your browser.</p>';
    const hint=document.createElement("div");
    hint.id="ssv-finder-hint";hint.className="ssv-finder-hint";hint.setAttribute("role","status");
    hint.innerHTML='<span>Find your perfect saree <span aria-hidden="true">✨</span></span><button type="button" class="ssv-finder-hint-close" aria-label="Dismiss Finder hint">×</button>';
    let hintSeen=false;
    try{hintSeen=sessionStorage.getItem("ssv-finder-hint-seen")==="1";}catch(_){}
    if(!hintSeen){
      document.body.append(hint);
      try{sessionStorage.setItem("ssv-finder-hint-seen","1");}catch(_){}
    }
    function dismissHint(returnFocus){
      if(hint.isConnected)hint.remove();
      if(returnFocus)trigger.focus();
    }
    document.body.append(trigger,panel);
    const hintClose=$(".ssv-finder-hint-close",hint);
    if(hintClose)hintClose.addEventListener("click",()=>dismissHint(true));
    trigger.addEventListener("click",()=>{dismissHint(false);lastFocus=document.activeElement;setBackgroundInert(panel,true);panel.hidden=false;trigger.hidden=true;trigger.setAttribute("aria-expanded","true");$("#ssv-finder-category").focus();loadCatalogue();});
    $("#ssv-finder-category",panel).addEventListener("change",()=>{preferences.category=$("#ssv-finder-category").value;preferences.color="";quickFilter="";$("#ssv-finder-color").value="";syncColorField();populateColors();$("#ssv-finder-results").replaceChildren();$("#ssv-finder-intro").textContent=["jewellery","jewelry"].includes(preferences.category.toLowerCase())?"Choose your budget to find gold jewellery. No colour selection is needed.":"Choose a budget, optional recorded colour and occasion.";$("#ssv-finder-message").textContent="Category updated. Choose your preferences and find matching products.";});
    $(".ssv-finder-close",panel).addEventListener("click",closePanel);
    $("#ssv-finder-form",panel).addEventListener("submit",async event=>{event.preventDefault();const submit=$("#ssv-finder-form .ssv-finder-submit",panel);submit.disabled=true;try{await loadCatalogue();if(!loaded)return;readPreferences();quickFilter="";recommend();}finally{submit.disabled=false;}});
    $("#ssv-finder-reset",panel).addEventListener("click",()=>{preferences={category:"Sarees",budget:"",color:"",occasion:""};quickFilter="";$("#ssv-finder-form").reset();$("#ssv-finder-intro").textContent="Choose a category and budget. Sarees and dresses can also be filtered by recorded colour.";syncColorField();populateColors();$("#ssv-finder-results").replaceChildren();$("#ssv-finder-message").textContent="Preferences cleared. Choose what matters to you.";});
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
    message.textContent="Loading current collection…";
    loadPromise=(async()=>{
      try{
        const response=await fetch("./data/products.json?finder="+Date.now(),{cache:"no-store",headers:{Accept:"application/json"}});
        if(!response.ok)throw new Error("Catalogue request failed ("+response.status+").");
        const data=await response.json();if(!Array.isArray(data))throw new Error("Catalogue format is not valid.");
        const seenIds=new Set();
        catalogue=data.filter(p=>{
          if(!p||typeof p!=="object")return false;
          const id=Number(p.id),name=String(p.name||"").trim(),category=String(p.category||"").trim().toLowerCase();
          const rawPrice=p.price,price=Number(rawPrice),image=String(p.image||"").trim();
          if(!Number.isSafeInteger(id)||id<=0||seenIds.has(id)||!name||!image)return false;
          if(rawPrice===null||rawPrice===undefined||String(rawPrice).trim()===""||!["sarees","dresses","jewelry","jewellery"].includes(category)||!Number.isFinite(price)||price<=0)return false;
          seenIds.add(id);
          return true;
        });
        try{const settingsResponse=await fetch("./data/settings.json?finder="+Date.now(),{cache:"no-store",headers:{Accept:"application/json"}});if(settingsResponse.ok){const settings=await settingsResponse.json();if(settings&&typeof settings==="object")shopSettings=settings;}}catch(_){shopSettings={};}
        loaded=true;populateColors();
        message.textContent=catalogue.length?"Choose your category and preferences, then find matching products.":"No supported products are currently available in the catalogue.";
        return true;
      }catch(error){
        loadPromise=null;
        message.textContent="The finder could not load the catalogue. Please try again.";
        return false;
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
    const colors=jewellery?[]:[...new Map(catalogue.filter(p=>String(p.category||"").trim().toLowerCase()===category.toLowerCase()).map(p=>String(p.color||((p.visualAttributes&&p.visualAttributes.source==="admin-approved")?p.visualAttributes.color:"")||"").trim()).filter(Boolean).map(color=>[color.toLocaleLowerCase(),color])).values()].sort((a,b)=>a.localeCompare(b));
    select.innerHTML='<option value="">'+(colors.length?"Any colour":"Any colour (no recorded colours)")+'</option>'+colors.map(color=>'<option value="'+esc(color)+'">'+esc(color)+'</option>').join("");
    if(!jewellery&&colors.some(color=>color.toLowerCase()===current.toLowerCase()))select.value=colors.find(color=>color.toLowerCase()===current.toLowerCase())||"";
    if(jewellery)select.value="";
  }
  function readPreferences(){const form=$("#ssv-finder-form");const category=form.elements.category.value;preferences={category,budget:form.elements.budget.value,color:["jewellery","jewelry"].includes(category.trim().toLowerCase())?"":form.elements.color.value,occasion:form.elements.occasion.value};}
  // Match checkout.js: reject explicit sold-out signals, but do not hide legacy
  // products merely because an optional stock field is absent.
  function isAvailable(p){return p.availability!==false&&p.inStock!==false&&p.outOfStock!==true;}
  function isCategoryEnabled(category){
    const key=({Sarees:"categorySareesEnabled",Dresses:"categoryDressesEnabled",Jewellery:"categoryJewelryEnabled"})[String(category||"").trim()];
    const value=key?shopSettings[key]:undefined;
    return value!==false&&value!=="false"&&value!==0&&value!=="0";
  }
  function navigateToProduct(product){
    const category=String(product.category||preferences.category||"Sarees");
    closePanel();
    const grid=$("#products");
    if(!grid||product.id==null)return;
    // Clear search first, because each catalogue render recreates its tabs.
    const search=$("#search")||$("#shop .lux-search input");
    if(search&&search.value){search.value="";search.dispatchEvent(new Event("input",{bubbles:true}));}
    const categoryTab=[...document.querySelectorAll("[data-tab]")].find(tab=>String(tab.dataset.tab||"").toLowerCase()===category.toLowerCase()||(["jewellery","jewelry"].includes(String(tab.dataset.tab||"").toLowerCase())&&["jewellery","jewelry"].includes(category.toLowerCase())));
    if(!categoryTab){if($("#shop"))$("#shop").scrollIntoView({behavior:"auto",block:"start"});return;}
    categoryTab.click();
    const item=[...grid.querySelectorAll("[data-product-id]")].find(card=>String(card.dataset.productId)===String(product.id));
    if(!item){if($("#shop"))$("#shop").scrollIntoView({behavior:"auto",block:"start"});return;}
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
      recovery.querySelector('[data-recovery="all"]').addEventListener("click",()=>{closePanel();const search=$("#search")||$("#shop .lux-search input");if(search)search.value="";const storefront=window.SSVStorefront;if(storefront&&typeof storefront.showAllProducts==="function")storefront.showAllProducts();if($("#shop"))$("#shop").scrollIntoView({behavior:"auto",block:"start"});});
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
      const availabilityLabel=(product.availability===true||product.inStock===true)?"In stock":"Availability not specified";
      const savedVisual=product.visualAttributes&&product.visualAttributes.source==="admin-approved"?product.visualAttributes:{};
      const displayColor=product.color||savedVisual.color||"";
      const details=[displayColor?(product.color?"Recorded colour: ":"Visual colour: ")+String(displayColor).trim():"",savedVisual.pattern?"Pattern: "+String(savedVisual.pattern):"",availabilityLabel].filter(Boolean).join(" · ");
      const card=document.createElement("article");card.className="ssv-finder-result";card.dataset.productId=String(product.id??"");
      card.innerHTML='<img loading="lazy" src="'+esc(imageUrl)+'" alt="'+esc(product.name||categoryLabel)+'"><div class="ssv-finder-result-copy">'+'<h3>'+esc(product.name||categoryLabel)+'</h3><p class="ssv-finder-price">'+money(product.price)+(hasOriginalPrice?' <del class="ssv-finder-original">'+money(originalPrice)+'</del>':"")+'</p>'+(badges.length?'<p class="ssv-finder-badges">'+badges.map(badge=>'<span>'+esc(badge)+'</span>').join("")+'</p>':"")+'<p class="ssv-finder-meta">'+esc(details)+'</p><div class="ssv-finder-product-actions"><button type="button" class="ssv-finder-view">View Product</button><button type="button" class="ssv-finder-add">Add to Bag</button></div></div>';
      $(".ssv-finder-view",card).addEventListener("click",()=>navigateToProduct(product,false));
      $(".ssv-finder-add",card).addEventListener("click",()=>{
        const cartApi=window.SSVCart;
        if(!cartApi||typeof cartApi.addProduct!=="function"){
          $("#ssv-finder-message").textContent="The bag is still loading. Please try again in a moment.";
          return;
        }
        const result=cartApi.addProduct(product.id);
        if(result.ok){$("#ssv-finder-message").textContent="Added to your bag: "+String(product.name||"item")+". Quantity in bag: "+result.quantity+".";return;}
        const messages={"unavailable":"This item is no longer available.","out-of-stock":"This item is sold out.","max-quantity":"You can add up to 10 of this item.","storage":"We couldn’t save your bag. Please check your browser storage and try again."};
        $("#ssv-finder-message").textContent=messages[result.reason]||"We couldn’t add this item. Please try again.";
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
  // Occasion inference is conservative: explicit Admin tags win. Otherwise only
  // specific occasion language is strong enough to infer a use case. Fabric/embellishment
  // terms alone are not reliable occasion labels and must not create false certainty.
  const OCCASION_VALUES=new Set(["daily wear","wedding","festive","party wear","traditional"]);
  function inferOccasions(product){
    const raw=product&&product.occasions;
    const explicit=Array.isArray(raw)
      ? [...new Set(raw.filter(value=>typeof value==="string").map(value=>value.trim().toLowerCase()).filter(value=>OCCASION_VALUES.has(value)))]
      : [];
    // A non-empty, valid explicit tag list is authoritative. Do not augment or override it.
    if(explicit.length)return explicit;
    // Any malformed non-empty metadata fails closed instead of falling through to inference.
    if(raw!==undefined&&raw!==null){
      const hasRawValue=Array.isArray(raw)?raw.some(value=>String(value??"").trim().length>0):String(raw).trim().length>0;
      if(hasRawValue)return [];
    }
    const text=[product.name,product.description,product.material,product.fabric,product.style,product.type,product.subcategory,product.tags]
      .flatMap(value=>Array.isArray(value)?value:[value])
      .filter(value=>typeof value==="string"&&value.trim())
      .join(" ").toLowerCase().normalize("NFKC").replace(/[_-]+/g," ").replace(/\s+/g," ");
    if(!text)return [];
    const inferred=[];
    const has=pattern=>pattern.test(text);
    // Only direct occasion wording / explicit use cases qualify. Generic textile words
    // such as cotton, pattu, zari, silk, handloom and embroidery are intentionally excluded.
    if(has(/\b(daily wear|everyday wear|every day wear|casual wear|office wear|workwear|for daily use|everyday saree)\b/))inferred.push("daily wear");
    if(has(/\b(wedding wear|wedding guest|bridal wear|bridal saree|for weddings|wedding collection|bride to be)\b/))inferred.push("wedding");
    if(has(/\b(festive wear|festival wear|for festivals|diwali collection|sankranti collection|dasara collection|navratri collection|festive collection)\b/))inferred.push("festive");
    if(has(/\b(party wear|partywear|cocktail wear|evening wear|party collection|for parties)\b/))inferred.push("party wear");
    if(has(/\b(traditional wear|traditional collection|ethnic occasion wear|heritage collection|temple wear)\b/))inferred.push("traditional");
    if(inferred.length)return [...new Set(inferred)];
    const approved=product.visualAttributes;
    if(approved&&approved.source==="admin-approved"&&Array.isArray(approved.occasions)){
      const saved=approved.occasions.filter(value=>typeof value==="string").map(value=>value.trim().toLowerCase()).filter(value=>OCCASION_VALUES.has(value));
      if(saved.length)return [...new Set(saved)];
    }
    return [];
  }
  function hasExplicitOccasionDecision(product){
    const raw=product&&product.occasions;
    if(raw===undefined||raw===null)return false;
    // Any non-empty Admin metadata is authoritative, including malformed values:
    // malformed values fail closed instead of being replaced by image guesses.
    if(!Array.isArray(raw))return String(raw).trim().length>0;
    return raw.some(value=>String(value??"").trim().length>0);
  }
  function matchesOccasion(product,occasion){
    const wanted=String(occasion||"").trim().toLowerCase();
    if(!wanted)return true;
    if(!OCCASION_VALUES.has(wanted))return false;
    return inferOccasions(product).includes(wanted);
  }
  let aiOccasionModulePromise=null;
  const AI_OCCASION_SCAN_LIMIT=24;
  async function loadOccasionScanner(){
    if(!aiOccasionModulePromise){
      aiOccasionModulePromise=import("./saree-occasion-ai.js").then(module=>module.createOccasionScanner()).catch(error=>{
        aiOccasionModulePromise=null;
        throw error;
      });
    }
    return aiOccasionModulePromise;
  }
  async function addAiOccasionMatches(products,occasion){
    const resolved=new Map();
    // Keyword inference has priority. AI only examines untagged products for which
    // the existing conservative keyword rules found no occasion at all.
    const eligible=products.filter(product=>!hasExplicitOccasionDecision(product)&&!(product.visualAttributes&&product.visualAttributes.source==="admin-approved")&&inferOccasions(product).length===0);
    if(!eligible.length)return resolved;
    // Bound first-run CPU/network work. The browser model is loaded only when an
    // occasion filter is used; explicit Admin decisions never trigger image analysis.
    const toScan=eligible.slice(0,AI_OCCASION_SCAN_LIMIT);
    try{
      const scanner=await loadOccasionScanner();
      for(let index=0;index<toScan.length;index++){
        const product=toScan[index];
        const message=$("#ssv-finder-message");
        if(message)message.textContent="Checking product images for "+occasion+" ("+(index+1)+" of "+toScan.length+"). First use downloads a free AI model; it is cached by your browser where supported.";
        try{
          const result=await scanner.classify(product.image,product.category);
          if(result&&OCCASION_VALUES.has(result.label)&&result.score>=0.30&&result.margin>=0.07){
            resolved.set(String(product.id),result.label);
          }
        }catch(_){
          // A broken image, offline browser, blocked CDN or model error must not
          // break the Finder. Keyword inference remains the fallback.
        }
      }
    }catch(_){
      // Public, free model delivery is optional. Existing tag/keyword logic remains usable.
    }
    return resolved;
  }
  async function recommend(){
    const message=$("#ssv-finder-message");
    const category=preferences.category||"Sarees";
    allMatches=catalogue.filter(p=>String(p.category||"").trim().toLowerCase()===category.toLowerCase()).filter(p=>isCategoryEnabled(p.category)).filter(p=>isAvailable(p));
    if(quickFilter==="newArrival")allMatches=allMatches.filter(p=>p.newArrival===true);
    if(quickFilter==="bestSeller")allMatches=allMatches.filter(p=>p.bestSeller===true);
    if(preferences.budget!==""){
      const budget=Number(preferences.budget);
      if(!Number.isFinite(budget)||budget<0){allMatches=[];shownCount=3;renderMatches();return;}
      allMatches=allMatches.filter(p=>Number(p.price)<=budget);
    }
    if(preferences.color&& !["jewellery","jewelry"].includes(category.trim().toLowerCase()))allMatches=allMatches.filter(p=>String(p.color||((p.visualAttributes&&p.visualAttributes.source==="admin-approved")?p.visualAttributes.color:"")||"").trim().toLowerCase()===preferences.color.toLowerCase());
    // Explicit Admin tags are authoritative. For untagged products, run the free
    // browser-side image model lazily, then retain conservative keyword inference
    // for products outside the scan window or if the model is unavailable.
    if(preferences.occasion){
      const requested=preferences.occasion.trim().toLowerCase();
      if(OCCASION_VALUES.has(requested)){
        const aiMatches=await addAiOccasionMatches(allMatches,requested);
        allMatches=allMatches.filter(product=>{
          if(hasExplicitOccasionDecision(product))return matchesOccasion(product,requested);
          const keywordMatches=matchesOccasion(product,requested);
          return keywordMatches||aiMatches.get(String(product.id))===requested;
        });
      }else allMatches=[];
    }
    // Deterministic recommendation score: products matching both merchandising
    // signals lead, followed by one signal, then price. Ties preserve catalogue order.
    allMatches=allMatches.map((product,index)=>({product,index,score:(product.bestSeller===true?2:0)+(product.newArrival===true?1:0)}))
      .sort((a,b)=>b.score-a.score||Number(a.product.price)-Number(b.product.price)||a.index-b.index)
      .map(entry=>entry.product);
    shownCount=Math.min(3,allMatches.length);
    if(!allMatches.length)message.textContent="";
    renderMatches();
  }
  function start(){try{shell();}catch(error){console.error("Smart Saree Finder could not initialize.",error);}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();