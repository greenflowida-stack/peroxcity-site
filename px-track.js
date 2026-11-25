/* PeroXcity conversion tracking helpers.
   Pushes named events into the Google Tag Manager dataLayer (container GTM-NMPZML4H).
   In GTM, create a "Custom Event" trigger for each event name below and attach your
   Google Ads / GA4 conversion tags to it:
     generate_lead   - Fit Finder (mix guide) form or giveaway entry submitted
     phone_click     - any "Call" / tel: link tapped
     email_click     - any mailto: link clicked
     add_to_cart     - Shopify "Add to Cart" button
     begin_checkout  - Shopify cart "Checkout" or last-chance "Apply & Checkout"
   Purchases complete on Shopify's checkout domain, so the purchase conversion
   must be set up in Shopify (Google & YouTube app or a Customer Events pixel). */
(function(){
  window.dataLayer = window.dataLayer || [];
  window.pxTrack = function(event, params){
    var o = { event: event };
    if(params){ for(var k in params){ if(Object.prototype.hasOwnProperty.call(params, k)) o[k] = params[k]; } }
    window.dataLayer.push(o);
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
