
(function(){
  "use strict";
  const WORKER_URL = "https://ssv-admin-otp.vinith-paithari.workers.dev";
  const CART_KEY = "ssv_guest_cart_v1";
  const MAX_QUANTITY = 10;
  const $ = (selector, root=document) => root.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  let cart = readCart();
  let toastTimer = 0;
  let submitting = false;
  let lastSubmittedOrder = null;
  function readCart(){
    try{
      const raw=JSON.parse(localStorage.getItem(CART_KEY)||"[]");
      if(!Array.isArray(raw))return [];
      // Preserve valid legacy cart rows and safely cap their quantity at the current limit.
      // Persist the normalized shape immediately so stale values cannot return on reload.
      const normalized=raw
        .filter(row=>row&&Number.isSafeInteger(Number(row.id))&&Number(row.id)>0&&Number.isInteger(Number(row.quantity))&&Number(row.quantity)>0)
        .map(row=>({id:Number(row.id),quantity:Math.min(MAX_QUANTITY,Number(row.quantity))}));
      // Storage may be readable even when writes are blocked or quota-limited.
      // Keep the in-memory cart usable if persisting normalization fails.
      try{localStorage.setItem(CART_KEY,JSON.stringify(normalized))}catch(_){}
      return normalized;
    }catch(_){return [];}
  }
  function saveCart(nextCart=cart){try{localStorage.setItem(CART_KEY,JSON.stringify(nextCart.map(row=>({id:row.id,quantity:row.quantity}))));return true}catch(_){return false}}
  function currentProducts(){try{return Array.isArray(products)?products:[]}catch(_){return []}}
  function getProduct(id){return currentProducts().find(p=>Number(p.id)===Number(id))}
  function productImage(p){if(!p)return "";const src=String(p.image||"");return /^(https?:|data:|blob:)/i.test(src)?src:"https://raw.githubusercontent.com/srisaivanicollections/srisaivanicollections.github.io/main/"+src.replace(/^\.\//,"")}
  function count(){return cart.reduce((sum,row)=>sum+row.quantity,0)}
  function injectStylesAndShell(){
    if(!$("#ssv-cart-trigger")){
      const header=$(".header-inner");
      if(header){
        const button=document.createElement("button");
        button.id="ssv-cart-trigger";button.type="button";button.setAttribute("aria-label","Open cart");button.setAttribute("aria-haspopup","dialog");
        button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6"></path><circle cx="10" cy="20" r="1"></circle><circle cx="18" cy="20" r="1"></circle></svg><span id="ssv-cart-count" hidden>0</span>';
        const brand=$(".brand",header);brand?brand.insertAdjacentElement("afterend",button):header.prepend(button);
      }
    }
    if(!$("#ssv-cart-layer")){
      const layer=document.createElement("div");layer.id="ssv-cart-layer";
      layer.innerHTML='<div id="ssv-cart-backdrop" data-cart-close></div><section id="ssv-cart-drawer" role="dialog" aria-modal="true" aria-labelledby="ssv-cart-title" tabindex="-1"><header class="ssv-cart-head"><h2 id="ssv-cart-title">Your bag</h2><div class="ssv-cart-head-actions"><button type="button" id="ssv-clear-bag" aria-haspopup="dialog" aria-controls="ssv-clear-bag-dialog">Clear bag</button><button type="button" class="ssv-cart-close" aria-label="Close cart" data-cart-close>×</button></div></header><div id="ssv-cart-content"></div><footer class="ssv-cart-footer" id="ssv-cart-footer"><button type="button" id="ssv-proceed-checkout">Proceed to checkout</button><button type="button" class="ssv-continue" data-cart-close>Continue shopping</button></footer></section><div id="ssv-clear-bag-dialog" class="ssv-clear-dialog-layer" hidden><div class="ssv-clear-dialog-backdrop" data-clear-cancel></div><section class="ssv-clear-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ssv-clear-dialog-title" aria-describedby="ssv-clear-dialog-message" tabindex="-1"><h3 id="ssv-clear-dialog-title">Clear your bag?</h3><p id="ssv-clear-dialog-message">This will remove all items from your bag. This action cannot be undone.</p><div class="ssv-clear-dialog-actions"><button type="button" data-clear-cancel>Keep shopping</button><button type="button" class="ssv-clear-confirm" data-clear-confirm>Clear bag</button></div></section></div></div>';
      layer.insertAdjacentHTML("beforeend", '<div id="ssv-order-close-prompt" class="ssv-order-close-layer" hidden><div class="ssv-order-close-backdrop"></div><section class="ssv-order-close-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ssv-order-close-title" aria-describedby="ssv-order-close-message" tabindex="-1"><span class="ssv-order-close-mark" aria-hidden="true">↓</span><h3 id="ssv-order-close-title">Save your order details?</h3><p id="ssv-order-close-message">Your order has been received. Download a PDF copy of the order summary before closing this screen.</p><button type="button" class="ssv-order-close-download" data-order-close-download>Download order details (PDF)</button><button type="button" class="ssv-order-close-skip" data-order-close-skip>Close without downloading</button><button type="button" class="ssv-order-close-stay" data-order-close-stay>Stay on this page</button></section></div>');
      document.body.appendChild(layer);
    }
    if(!$("#ssv-cart-toast")){const toast=document.createElement("div");toast.id="ssv-cart-toast";toast.setAttribute("role","status");toast.setAttribute("aria-live","polite");document.body.appendChild(toast)}
  }
  function attachCardButtons(){
    const grid=$("#products");if(!grid)return false;
    let added=false;
    grid.querySelectorAll(".lux-item-media").forEach(media=>{
      if(media.querySelector(".ssv-add-cart"))return;
      const img=$("img",media);if(!img)return;
      const product=currentProducts().find(p=>String(p.name||"")===String(img.alt||"")||(typeof cleanProductName==="function"&&String(cleanProductName(p.name))===String(img.alt||"")));
      if(!product||product.availability===false||product.inStock===false||product.outOfStock===true)return;
      const button=document.createElement("button");button.type="button";button.className="ssv-add-cart";button.dataset.addCart=String(product.id);button.setAttribute("aria-label","Add "+product.name+" to cart");button.title="Add to cart";
      button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>';
      media.appendChild(button);
      added=true;
    });
    return added;
  }
  function updateCount(){
    const badge=$("#ssv-cart-count");
    if(badge){badge.textContent=String(count());badge.hidden=count()===0}
    const trigger=$("#ssv-cart-trigger");
    if(trigger)trigger.setAttribute("aria-label","Open cart, "+count()+" items");
    // Keep each product's icon synchronized with the actual cart contents.
    // The existing add-to-cart toast and click behavior remain unchanged.
    document.querySelectorAll("#products [data-add-cart]").forEach(button=>{
      const id=Number(button.dataset.addCart);
      const row=cart.find(item=>item.id===id);
      const product=getProduct(id);
      const inCart=Boolean(row);
      button.innerHTML=(inCart
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"></path></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>')+(inCart
          ? '<span aria-hidden="true" style="position:absolute;top:-3px;right:-3px;display:grid;place-items:center;min-width:16px;height:16px;padding:0 3px;box-sizing:border-box;border-radius:99px;background:#6E2735;color:#fff;font:600 10px/1 Inter,Arial,sans-serif;box-shadow:0 0 0 1px #FAF7F2">' + row.quantity + '</span>'
          : "");
      button.setAttribute("aria-label",inCart
        ? "In cart: "+(product?.name||"product")+", quantity "+row.quantity+". Add one more"
        : "Add "+(product?.name||"product")+" to cart");
      button.title=inCart?"In cart · quantity "+row.quantity+" · click to add another":"Add to cart";
      button.classList.toggle("is-in-cart",inCart);
    });
  }
  function showToast(message){const toast=$("#ssv-cart-toast");if(!toast)return;toast.textContent=message;toast.classList.add("is-visible");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("is-visible"),1800)}
  function openCart(){const layer=$("#ssv-cart-layer");if(!layer)return;layer.classList.add("is-open");document.body.style.overflow="hidden";renderCart();setTimeout(()=>$("#ssv-cart-drawer")?.focus(),0)}
  function closeCart(){const layer=$("#ssv-cart-layer");if(!layer)return;closeClearBagDialog(false);closeOrderClosePrompt(false);layer.classList.remove("is-open");document.body.style.overflow="";$("#ssv-cart-trigger")?.focus()}
  function openOrderClosePrompt(){const prompt=$("#ssv-order-close-prompt");if(!prompt)return;prompt.hidden=false;prompt.querySelector(".ssv-order-close-dialog")?.focus()}
  function closeOrderClosePrompt(restoreFocus=true){const prompt=$("#ssv-order-close-prompt");if(!prompt)return;prompt.hidden=true;if(restoreFocus)$("#ssv-order-close-dialog")?.focus()}
  function handleCloseAfterOrder(){if(lastSubmittedOrder){openOrderClosePrompt();return}closeCart()}
  function closeWithoutOrderDownload(){lastSubmittedOrder=null;closeOrderClosePrompt(false);closeCart()}
  function downloadAndCloseOrder(){if(!lastSubmittedOrder)return;downloadOrderDetails();lastSubmittedOrder=null;closeOrderClosePrompt(false);closeCart()}
  let clearingBag=false;
  function openClearBagDialog(){if(!cart.length||clearingBag)return;const dialog=$("#ssv-clear-bag-dialog");if(!dialog)return;const message=$("#ssv-clear-dialog-message");if(message)message.textContent="This will remove all items from your bag. This action cannot be undone.";dialog.hidden=false;dialog.querySelector("[data-clear-cancel]")?.focus()}
  function closeClearBagDialog(restoreFocus=true){const dialog=$("#ssv-clear-bag-dialog");if(!dialog)return;dialog.hidden=true;if(restoreFocus)$("#ssv-clear-bag")?.focus()}
  function confirmClearBag(){if(clearingBag||!cart.length)return;clearingBag=true;try{if(!saveCart([])){const message=$("#ssv-clear-dialog-message");if(message)message.textContent="Your bag could not be cleared because the change could not be saved. Please try again.";return}cart=[];updateCount();renderCart();closeClearBagDialog(false);$("#ssv-cart-drawer")?.focus()}finally{clearingBag=false}}
  function renderCart(){
    const content=$("#ssv-cart-content"),footer=$("#ssv-cart-footer"),layer=$("#ssv-cart-layer");if(!content||!footer)return;
    cart=cart.filter(row=>getProduct(row.id));
    saveCart();updateCount();
    const items=cart.map(row=>({row,p:getProduct(row.id)})).filter(x=>x.p);
    const clearButton=$("#ssv-clear-bag");if(clearButton){clearButton.hidden=items.length===0;clearButton.disabled=items.length===0}
    const form=$("#ssv-checkout-form");
    if(form&&form.classList.contains("is-visible")){renderCheckoutForm();return}
    if(!items.length){
      content.innerHTML='<div class="ssv-cart-empty"><strong>Your bag is waiting</strong><span>Add a piece from the collection to get started.</span></div>';
      footer.style.display="none";return;
    }
    footer.style.display="";
    content.innerHTML=items.map(({row,p})=>'<article class="ssv-cart-item"><img src="'+esc(productImage(p))+'" alt="'+esc(p.name)+'" loading="lazy"><div><h3>'+esc(p.name)+'</h3><div class="ssv-cart-item-actions"><button type="button" class="ssv-qty-btn" data-qty="-1" data-id="'+row.id+'" aria-label="Decrease quantity">−</button><span class="ssv-qty-value">'+row.quantity+'</span><button type="button" class="ssv-qty-btn" data-qty="1" data-id="'+row.id+'" aria-label="Increase quantity">+</button></div></div><button type="button" class="ssv-remove" data-remove="'+row.id+'">Remove</button></article>').join("");
  }
  function renderCheckoutForm(){
    const content=$("#ssv-cart-content"),footer=$("#ssv-cart-footer");if(!content||!footer)return;
    footer.style.display="none";
    let form=$("#ssv-checkout-form");
    if(!form){
      form=document.createElement("form");form.id="ssv-checkout-form";
      form.innerHTML='<button type="button" class="ssv-checkout-back" id="ssv-back-to-cart">← Back to bag</button><p class="ssv-cart-head" style="padding:0 0 12px;border:0"><strong style="font:500 27px Cormorant Garamond,Georgia,serif">Delivery details</strong></p><p class="ssv-checkout-intro">Enter your contact and delivery address. We will confirm availability and the final amount with you privately.</p><div class="ssv-form-grid"><div class="ssv-field ssv-wide"><label for="ssv-full-name">Full name *</label><input id="ssv-full-name" name="fullName" autocomplete="name" maxlength="100" required></div><div class="ssv-field ssv-wide"><label for="ssv-mobile">Mobile number *</label><input id="ssv-mobile" name="mobile" type="tel" inputmode="tel" autocomplete="tel" maxlength="16" pattern="[+0-9 ()-]{10,16}" required></div><div class="ssv-field ssv-wide"><label for="ssv-house">House / flat number and street *</label><input id="ssv-house" name="houseStreet" autocomplete="street-address" maxlength="180" required></div><div class="ssv-field ssv-wide"><label for="ssv-landmark">Landmark</label><input id="ssv-landmark" name="landmark" maxlength="120"></div><div class="ssv-field"><label for="ssv-city">Village / town / city *</label><input id="ssv-city" name="city" autocomplete="address-level2" maxlength="100" required></div><div class="ssv-field"><label for="ssv-district">District *</label><input id="ssv-district" name="district" maxlength="100" required></div><div class="ssv-field"><label for="ssv-state">State *</label><input id="ssv-state" name="state" autocomplete="address-level1" maxlength="100" required></div><div class="ssv-field"><label for="ssv-pin">PIN code *</label><input id="ssv-pin" name="pinCode" inputmode="numeric" autocomplete="postal-code" maxlength="6" pattern="[1-9][0-9]{5}" required></div></div><p id="ssv-checkout-status" role="status" aria-live="polite"></p><button class="ssv-checkout-submit" type="submit">Submit Order</button>';
      content.replaceChildren(form);
    }
    form.classList.add("is-visible");form.hidden=false;
  }
  function showCheckout(){if(!cart.length)return;const content=$("#ssv-cart-content");if(!content)return;let form=$("#ssv-checkout-form");if(!form){renderCheckoutForm();form=$("#ssv-checkout-form")}form.classList.add("is-visible");const clearButton=$("#ssv-clear-bag");if(clearButton){clearButton.hidden=true;clearButton.disabled=true}renderCheckoutForm();content.scrollTop=0;$("#ssv-full-name")?.focus()}
  function showStatus(message,success=false){const status=$("#ssv-checkout-status");if(!status)return;status.textContent=message;status.classList.toggle("is-success",success)}

  function orderPrintHtml(order){
    const address=[order.shipping.houseStreet,order.shipping.landmark,order.shipping.city,order.shipping.district,order.shipping.state,order.shipping.pinCode].filter(Boolean).join(", ");
    const rows=order.items.map((item,index)=>"<tr><td>"+(index+1)+"</td><td>"+esc(item.name)+"</td><td>"+item.quantity+"</td></tr>").join("");
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Order Details - '+esc(order.reference)+'</title><style>'+
      'body{margin:0;padding:24px;background:#faf7f2;color:#1c1917;font:14px/1.55 Arial,sans-serif}.sheet{max-width:760px;margin:0 auto;padding:32px;background:#fff;border:1px solid #e4d8c5}.brand{text-align:center;font:26px Georgia,serif;letter-spacing:2px;margin:0}.sub{text-align:center;color:#8b6338;font-size:10px;letter-spacing:3px;margin:5px 0 26px}h1{font:30px Georgia,serif;margin:0 0 18px}h2{font:600 12px Arial,sans-serif;letter-spacing:1.2px;text-transform:uppercase;color:#8b6338;margin:24px 0 8px}.panel{padding:13px;background:#faf7f2;border:1px solid #e4d8c5}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e4d8c5}th{background:#f4eee4}td:last-child,th:last-child{text-align:center}.note{font-size:11px;color:#625d55;margin-top:24px}.actions{text-align:center;margin:0 auto 18px}.actions button{padding:11px 18px;background:#1c1917;color:#faf7f2;border:0;font-size:12px;cursor:pointer}@media print{body{padding:0;background:#fff}.sheet{max-width:none;border:0;padding:0}.actions{display:none}h2,tr{break-inside:avoid}}@media(max-width:520px){body{padding:10px}.sheet{padding:18px}}'+
      '</style></head><body><div class="actions"><button onclick="window.print()">Save as PDF / Print</button><p class="note">In the print dialog, choose “Save as PDF” to download a PDF copy.</p></div><main class="sheet"><p class="brand">SRI SAI VANI</p><p class="sub">COLLECTIONS</p><h1>Order Details</h1><div class="panel"><b>Order reference:</b> '+esc(order.reference)+'<br><b>Order date:</b> '+esc(order.createdAt)+'</div><h2>Customer details</h2><div class="panel"><b>'+esc(order.customer.fullName)+'</b><br>Mobile: '+esc(order.customer.mobile)+'</div><h2>Delivery address</h2><div class="panel">'+esc(address)+'</div><h2>Items ordered</h2><table><thead><tr><th>#</th><th>Product</th><th>Quantity</th></tr></thead><tbody>'+rows+'</tbody></table><p class="note">This is an order summary, not a tax invoice. Availability, delivery, and final amount will be confirmed by the store.</p></main></body></html>';
  }
  function downloadOrderDetails(){
    if(!lastSubmittedOrder)return;
    const printWindow=window.open("","_blank");
    if(!printWindow){showToast("Allow pop-ups to open order details");return}
    printWindow.document.open();
    printWindow.document.write(orderPrintHtml(lastSubmittedOrder));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(()=>printWindow.print(),250);
  }
  async function submitCheckout(form){
    if(submitting)return;
    if(!cart.length){showStatus("Your cart is empty.");return}
    const fd=new FormData(form);
    const customer={fullName:String(fd.get("fullName")||"").trim(),mobile:String(fd.get("mobile")||"").trim()};
    const shipping={houseStreet:String(fd.get("houseStreet")||"").trim(),landmark:String(fd.get("landmark")||"").trim(),city:String(fd.get("city")||"").trim(),district:String(fd.get("district")||"").trim(),state:String(fd.get("state")||"").trim(),pinCode:String(fd.get("pinCode")||"").trim()};
    if(!form.reportValidity())return;
    const button=$(".ssv-checkout-submit",form);submitting=true;if(button){button.disabled=true;button.textContent="SUBMITTING…"}showStatus("Submitting your order securely…");
    try{
      const response=await fetch(WORKER_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"submitOrder",items:cart.map(row=>({id:row.id,quantity:row.quantity})),customer,shipping})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data.success!==true||data.accepted!==true)throw new Error(data.message||"We could not submit the order. Your cart has been kept.");
      lastSubmittedOrder={
        reference:String(data.reference||"Order received"),
        createdAt:new Date().toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}),
        customer,
        shipping,
        items:cart.map(row=>({name:String(getProduct(row.id)?.name||"Product"),quantity:row.quantity}))
      };
      try{localStorage.removeItem(CART_KEY)}catch(_){}
      cart=[];updateCount();
      const content=$("#ssv-cart-content"),footer=$("#ssv-cart-footer");if(footer)footer.style.display="none";
      content.innerHTML='<div class="ssv-order-success"><span class="ssv-success-mark" aria-hidden="true">✓</span><h3>Order received</h3><p>Your order request has been emailed to the store. We will contact you on your mobile number to confirm availability, delivery, and the final amount.</p><div class="ssv-order-ref">'+esc(data.reference||"Order received")+'</div><button type="button" class="ssv-checkout-submit ssv-download-order" data-download-order>Download order details (PDF)</button><p class="ssv-order-download-note">Choose “Save as PDF” in the print options.</p><button type="button" class="ssv-order-continue" data-cart-close>Continue shopping</button></div>';
    }catch(error){showStatus(error?.message||"Order submission failed. Your cart has been kept.");}
    finally{submitting=false;if(button&&button.isConnected){button.disabled=false;button.textContent="Submit Order"}}
  }
  document.addEventListener("click",event=>{
    const add=event.target.closest("[data-add-cart]");
    if(add){const id=Number(add.dataset.addCart),p=getProduct(id);if(!p)return;const row=cart.find(x=>x.id===id);if(row){if(row.quantity>=MAX_QUANTITY){showToast("Maximum quantity reached (10)");return}row.quantity++}else cart.push({id,quantity:1});saveCart();updateCount();showToast("Added to cart");if($("#ssv-cart-layer")?.classList.contains("is-open"))renderCart();return}
    if(event.target.closest("[data-order-close-download]")){downloadAndCloseOrder();return}
    if(event.target.closest("[data-order-close-skip]")){closeWithoutOrderDownload();return}
    if(event.target.closest("[data-order-close-stay]")){closeOrderClosePrompt();return}
    if(event.target.closest("[data-download-order]")){downloadOrderDetails();return}
    if(event.target.closest("#ssv-cart-trigger")){openCart();return}
    if(event.target.closest("[data-clear-cancel]")){closeClearBagDialog();return}
    if(event.target.closest("[data-clear-confirm]")){confirmClearBag();return}
    if(event.target.closest("#ssv-clear-bag")){openClearBagDialog();return}
    if(event.target.closest("[data-cart-close]")){handleCloseAfterOrder();return}
    const qty=event.target.closest("[data-qty]");if(qty){const row=cart.find(x=>x.id===Number(qty.dataset.id));if(row){const delta=Number(qty.dataset.qty);if(delta>0&&row.quantity>=MAX_QUANTITY){showToast("Maximum quantity reached (10)");return}row.quantity=Math.max(0,Math.min(MAX_QUANTITY,row.quantity+delta));if(!row.quantity)cart=cart.filter(x=>x!==row);saveCart();renderCart()}return}
    const remove=event.target.closest("[data-remove]");if(remove){cart=cart.filter(x=>x.id!==Number(remove.dataset.remove));saveCart();renderCart();return}
    if(event.target.closest("#ssv-proceed-checkout")){showCheckout();return}
    if(event.target.closest("#ssv-back-to-cart")){const form=$("#ssv-checkout-form");form?.classList.remove("is-visible");renderCart();return}
  });
  document.addEventListener("submit",event=>{if(event.target?.id==="ssv-checkout-form"){event.preventDefault();submitCheckout(event.target)}});
  document.addEventListener("keydown",event=>{
    const layer=$("#ssv-cart-layer");if(!layer?.classList.contains("is-open"))return;
    const orderPrompt=$("#ssv-order-close-prompt");
    if(orderPrompt&&!orderPrompt.hidden){
      if(event.key==="Escape"){event.preventDefault();closeOrderClosePrompt();return}
      if(event.key==="Tab"){
        const focusable=Array.from(orderPrompt.querySelectorAll('button:not([disabled])')).filter(el=>!el.hidden);
        if(!focusable.length){event.preventDefault();orderPrompt.querySelector(".ssv-order-close-dialog")?.focus();return}
        const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();return}
        if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();return}
      }
      return;
    }
    const dialog=$("#ssv-clear-bag-dialog");
    if(dialog&&!dialog.hidden){
      if(event.key==="Escape"){event.preventDefault();closeClearBagDialog();return}
      if(event.key==="Tab"){
        const panel=$(".ssv-clear-dialog",dialog);
        const focusable=Array.from(panel.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(el=>!el.hidden&&el.getAttribute("aria-hidden")!=="true");
        if(!focusable.length){event.preventDefault();panel.focus();return}
        const first=focusable[0],last=focusable[focusable.length-1];
        if(!panel.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first).focus();return}
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();return}
        if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();return}
      }
      return;
    }
    if(event.key==="Escape")closeCart();
  });
  // Observe catalogue rendering only to discover newly-created product cards.
  // updateCount() changes button contents, so it must not run on every DOM mutation.
  const observer=new MutationObserver(()=>{
    if(attachCardButtons())updateCount();
  });
  function init(){injectStylesAndShell();attachCardButtons();updateCount();observer.observe($("#products")||document.body,{childList:true,subtree:true});}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
