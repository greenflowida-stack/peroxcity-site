/* PeroXcity conversion tracking.
   The Google tag GTM-NMPZML4H (Ads destination AW-18593142542) is already
   on every page. pxTrack sends the matching Ads conversion and keeps the
   same event on dataLayer:
     generate_lead   Submit lead form   Fit Finder or giveaway
     phone_click     Contact            any tel: link
     email_click     Contact (1)        any mailto: link
     add_to_cart     Add to cart        Shopify Add to Cart
     begin_checkout  Begin checkout     cart Checkout or last-chance Apply & Checkout
   Purchases finish on Shopify's checkout domain, so purchase is not sent here. */
(function(){
  var sendTo = {
    generate_lead: 'AW-18593142542/BuAwCKXei78dEI6u86FF',
    phone_click: 'AW-18593142542/lXtTCKjei78dEI6u86FF',
    email_click: 'AW-18593142542/nLW9CKvei78dEI6u86FF',
    add_to_cart: 'AW-18593142542/qY_MCJ_ei78dEI6u86FF',
    begin_checkout: 'AW-18593142542/Nxc3CKLei78dEI6u86FF'
  };
  window.dataLayer = window.dataLayer || [];
  window.pxTrack = function(event, params){
    var o = { event: event };
    if(params){ for(var k in params){ if(Object.prototype.hasOwnProperty.call(params, k)) o[k] = params[k]; } }
    window.dataLayer.push(o);
    var label = sendTo[event];
    if(!label) return;
    window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
    var eco = params && params.ecommerce;
    var hit = { send_to: label, currency: 'USD', value: 1 };
    var raw = (eco && eco.value != null) ? eco.value : (params && params.value);
    var num = Number(raw);
    if(raw != null && raw !== '' && isFinite(num)) hit.value = num;
    var cur = (eco && eco.currency) || (params && params.currency);
    if(cur) hit.currency = cur;
    window.gtag('event', 'conversion', hit);
  };
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if(!a) return;
    var href = a.getAttribute('href') || '';
    var text = (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    if(/^tel:/i.test(href)){
      window.pxTrack('phone_click', { link_url: href, link_text: text, page_path: location.pathname });
    } else if(/^mailto:/i.test(href)){
      window.pxTrack('email_click', { link_url: href, link_text: text, page_path: location.pathname });
    }
  }, true);
})();
