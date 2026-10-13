
(function(){
  "use strict";
  const WORKER_URL = "https://ssv-admin-otp.vinith-paithari.workers.dev";
  const CART_KEY = "ssv_guest_cart_v1";
  const PENDING_KEY = "ssv_guest_order_idempotency_v1";
  const $ = (selector, root=document) => root.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  let cart = readCart();
  let toastTimer = 0;
  let submitting = false;
  function readCart(){
    try{
      const raw=JSON.parse(localStorage.getItem(CART_KEY)||"[]");
      if(!Array.isArray(raw))return [];
      return raw.filter(row=>Number.isSafeInteger(Number(row.id))&&Number(row.id)>0&&Number.isInteger(Number(row.quantity))&&Number(row.quantity)>0&&Number(row.quantity)<=20).map(row=>({id:Number(row.id),quantity:Number(row.quantity)}));
    }catch(_){return [];}
  }
  function saveCart(){try{localStorage.setItem(CART_KEY,JSON.stringify(cart.map(row=>({id:row.id,quantity:row.quantity}))))}catch(_){}}
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
      layer.innerHTML='<div id="ssv-cart-backdrop" data-cart-close></div><section id="ssv-cart-drawer" role="dialog" aria-modal="true" aria-labelledby="ssv-cart-title" tabindex="-1"><header class="ssv-cart-head"><h2 id="ssv-cart-title">Your bag</h2><button type="button" class="ssv-cart-close" aria-label="Close cart" data-cart-close>×</button></header><div id="ssv-cart-content"></div><footer class="ssv-cart-footer" id="ssv-cart-footer"><button type="button" id="ssv-proceed-checkout">Proceed to checkout</button><button type="button" class="ssv-continue" data-cart-close>Continue shopping</button></footer></section></div>';
      document.body.appendChild(layer);
    }
    if(!$("#ssv-cart-toast")){const toast=document.createElement("div");toast.id="ssv-cart-toast";toast.setAttribute("role","status");toast.setAttribute("aria-live","polite");document.body.appendChild(toast)}
  }
  function attachCardButtons(){
    const grid=$("#products");if(!grid)return;
    grid.querySelectorAll(".lux-item-media").forEach(media=>{
      if(media.querySelector(".ssv-add-cart"))return;
      const img=$("img",media);if(!img)return;
      const product=currentProducts().find(p=>String(p.name||"")===String(img.alt||"")||(typeof cleanProductName==="function"&&String(cleanProductName(p.name))===String(img.alt||"")));
      if(!product||product.availability===false||product.inStock===false||product.outOfStock===true)return;
      const button=document.createElement("button");button.type="button";button.className="ssv-add-cart";button.dataset.addCart=String(product.id);button.setAttribute("aria-label","Add "+product.name+" to cart");button.title="Add to cart";
      button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>';
      media.appendChild(button);
    });
  }
  function updateCount(){const badge=$("#ssv-cart-count");if(!badge)return;badge.textContent=String(count());badge.hidden=count()===0;const trigger=$("#ssv-cart-trigger");if(trigger)trigger.setAttribute("aria-label","Open cart, "+count()+" items")}
  function showToast(message){const toast=$("#ssv-cart-toast");if(!toast)return;toast.textContent=message;toast.classList.add("is-visible");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("is-visible"),1800)}
  function openCart(){const layer=$("#ssv-cart-layer");if(!layer)return;layer.classList.add("is-open");document.body.style.overflow="hidden";renderCart();setTimeout(()=>$("#ssv-cart-drawer")?.focus(),0)}
  function closeCart(){const layer=$("#ssv-cart-layer");if(!layer)return;layer.classList.remove("is-open");document.body.style.overflow="";$("#ssv-cart-trigger")?.focus()}
  function renderCart(){
    const content=$("#ssv-cart-content"),footer=$("#ssv-cart-footer"),layer=$("#ssv-cart-layer");if(!content||!footer)return;
    cart=cart.filter(row=>getProduct(row.id));
    saveCart();updateCount();
    const items=cart.map(row=>({row,p:getProduct(row.id)})).filter(x=>x.p);
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
  function showCheckout(){if(!cart.length)return;const content=$("#ssv-cart-content");if(!content)return;let form=$("#ssv-checkout-form");if(!form){renderCheckoutForm();form=$("#ssv-checkout-form")}form.classList.add("is-visible");renderCheckoutForm();content.scrollTop=0;$("#ssv-full-name")?.focus()}
  function showStatus(message,success=false){const status=$("#ssv-checkout-status");if(!status)return;status.textContent=message;status.classList.toggle("is-success",success)}
  async function submitCheckout(form){
    if(submitting)return;
    if(!cart.length){showStatus("Your cart is empty.");return}
    const fd=new FormData(form);
    const customer={fullName:String(fd.get("fullName")||"").trim(),mobile:String(fd.get("mobile")||"").trim()};
    const shipping={houseStreet:String(fd.get("houseStreet")||"").trim(),landmark:String(fd.get("landmark")||"").trim(),city:String(fd.get("city")||"").trim(),district:String(fd.get("district")||"").trim(),state:String(fd.get("state")||"").trim(),pinCode:String(fd.get("pinCode")||"").trim()};
    if(!form.reportValidity())return;
    let key="";
    try{key=sessionStorage.getItem(PENDING_KEY)||"";if(!/^[0-9a-f-]{36}$/i.test(key)){key=crypto.randomUUID();sessionStorage.setItem(PENDING_KEY,key)}}catch(_){key=crypto.randomUUID()}
    const button=$(".ssv-checkout-submit",form);submitting=true;if(button){button.disabled=true;button.textContent="SUBMITTING…"}showStatus("Submitting your order securely…");
    try{
      const response=await fetch(WORKER_URL,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":key},body:JSON.stringify({action:"submitOrder",idempotencyKey:key,items:cart.map(row=>({id:row.id,quantity:row.quantity})),customer,shipping})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data.success!==true||data.accepted!==true)throw new Error(data.message||"We could not submit the order. Your cart has been kept.");
      try{localStorage.removeItem(CART_KEY);sessionStorage.removeItem(PENDING_KEY)}catch(_){}
      cart=[];updateCount();
      const content=$("#ssv-cart-content"),footer=$("#ssv-cart-footer");if(footer)footer.style.display="none";
      content.innerHTML='<div class="ssv-order-success"><span class="ssv-success-mark" aria-hidden="true">✓</span><h3>Order received</h3><p>Your order has been recorded. We will contact you on your mobile number to confirm availability, delivery, and the final amount.</p><div class="ssv-order-ref">'+esc(data.reference||"Order received")+'</div>'+(data.notificationPending?'<p>Order saved. The store notification is still being processed.</p>':"")+'<button type="button" class="ssv-checkout-submit" data-cart-close>Continue shopping</button></div>';
    }catch(error){showStatus(error?.message||"Order submission failed. Your cart has been kept.");}
    finally{submitting=false;if(button&&button.isConnected){button.disabled=false;button.textContent="Submit Order"}}
  }
  document.addEventListener("click",event=>{
    const add=event.target.closest("[data-add-cart]");
    if(add){const id=Number(add.dataset.addCart),p=getProduct(id);if(!p)return;const row=cart.find(x=>x.id===id);if(row){if(row.quantity>=20){showToast("Maximum quantity reached");return}row.quantity++}else cart.push({id,quantity:1});saveCart();updateCount();showToast("Added to cart");if($("#ssv-cart-layer")?.classList.contains("is-open"))renderCart();return}
    if(event.target.closest("#ssv-cart-trigger")){openCart();return}
    if(event.target.closest("[data-cart-close]")){closeCart();return}
    const qty=event.target.closest("[data-qty]");if(qty){const row=cart.find(x=>x.id===Number(qty.dataset.id));if(row){row.quantity=Math.max(0,Math.min(20,row.quantity+Number(qty.dataset.qty)));if(!row.quantity)cart=cart.filter(x=>x!==row);saveCart();renderCart()}return}
    const remove=event.target.closest("[data-remove]");if(remove){cart=cart.filter(x=>x.id!==Number(remove.dataset.remove));saveCart();renderCart();return}
    if(event.target.closest("#ssv-proceed-checkout")){showCheckout();return}
    if(event.target.closest("#ssv-back-to-cart")){const form=$("#ssv-checkout-form");form?.classList.remove("is-visible");renderCart();return}
  });
  document.addEventListener("submit",event=>{if(event.target?.id==="ssv-checkout-form"){event.preventDefault();submitCheckout(event.target)}});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&$("#ssv-cart-layer")?.classList.contains("is-open"))closeCart()});
  const observer=new MutationObserver(()=>{attachCardButtons();updateCount()});
  function init(){injectStylesAndShell();attachCardButtons();updateCount();observer.observe($("#products")||document.body,{childList:true,subtree:true});}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
