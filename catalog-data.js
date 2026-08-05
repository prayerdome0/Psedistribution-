/* ============================================================
   CATALOG-DATA.JS — Pilot Sales Distribution
   Sample product + category dataset for the wholesale catalog
   PDF generator and the /catalogs download page.

   This mirrors the columns in pse_wholesale_products_template.csv.
   In production, replace `products` with a Firestore fetch
   (see note at the bottom of this file).
   ============================================================ */
(function () {
  'use strict';

  window.PSE_CATALOG_DATA = {
    site: {
      name: 'Pilot Sales Distribution',
      url: 'https://pilotsalesdistribution.com',
      registerUrl: 'https://pilotsalesdistribution.com/register',
      rfqUrl: 'https://pilotsalesdistribution.com/rfq',
      tagline: 'Premium Wholesale Marketplace'
    },

    /* Category metadata — keys MUST match product.category values. */
    categories: {
      all: {
        id: 'all',
        name: 'Full Wholesale Catalog',
        cover: 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80',
        blurb: 'Every category in one master line sheet — curated from verified suppliers.'
      },
      electronics: {
        id: 'electronics',
        name: 'Electronics',
        cover: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80',
        blurb: 'Audio, computing & smart devices at bulk MOQ pricing.'
      },
      fashion: {
        id: 'fashion',
        name: 'Fashion',
        cover: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80',
        blurb: 'Apparel & footwear from verified brand suppliers.'
      },
      home: {
        id: 'home',
        name: 'Home',
        cover: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80',
        blurb: 'Household, kitchen & smart-home wholesale lots.'
      },
      sports: {
        id: 'sports',
        name: 'Sports',
        cover: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80',
        blurb: 'Footwear, fitness & outdoor bulk inventory.'
      },
      health: {
        id: 'health',
        name: 'Health & Wellness',
        cover: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=80',
        blurb: 'Supplements & wellness products, MOQ from 18 units.'
      },
      office: {
        id: 'office',
        name: 'Office',
        cover: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=80',
        blurb: 'Ergonomic & productivity gear for resellers.'
      },
      grocery: {
        id: 'grocery',
        name: 'Grocery',
        cover: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
        blurb: 'Fairtrade & bulk consumables for retailers.'
      },
      beauty: {
        id: 'beauty',
        name: 'Beauty',
        cover: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
        blurb: 'Skincare & cosmetics wholesale lines.'
      },
      automotive: {
        id: 'automotive',
        name: 'Automotive',
        cover: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
        blurb: 'Car care & accessory bulk lots.'
      }
    },

    /* Product list — same fields as pse_wholesale_products_template.csv.
       image_url uses picsum.photos which sends CORS headers so the
       browser can embed the photos directly into the PDF. */
    products: [
      { title: 'Wireless Noise Cancelling Headphones', brand: 'Sony', price: 89.00, old_price: 119.00, moq: 24, category: 'electronics', image_url: 'https://picsum.photos/id/1015/600/600', sku: 'SONY-WH1000XM5', lead_time: '7-10 days', supplier_tier: 'gold', rating: 4.7 },
      { title: 'Bluetooth Portable Speaker', brand: 'JBL', price: 35.00, old_price: 49.00, moq: 30, category: 'electronics', image_url: 'https://picsum.photos/id/1018/600/600', sku: 'JBL-FLIP6', lead_time: '4-6 days', supplier_tier: 'gold', rating: 4.6 },
      { title: 'Premium Cotton T-Shirt Pack (10 pcs)', brand: 'Adidas', price: 45.00, old_price: 59.00, moq: 50, category: 'fashion', image_url: 'https://picsum.photos/id/1005/600/600', sku: 'ADIDAS-TS10', lead_time: '3-5 days', supplier_tier: 'platinum', rating: 4.5 },
      { title: 'Denim Jeans Slim Fit', brand: "Levi's", price: 38.00, old_price: 52.00, moq: 24, category: 'fashion', image_url: 'https://picsum.photos/id/1009/600/600', sku: 'LEVIS-511', lead_time: '6-8 days', supplier_tier: 'platinum', rating: 4.3 },
      { title: 'Stainless Steel Water Bottle 1L', brand: 'Hydro Flask', price: 12.50, old_price: 16.00, moq: 100, category: 'home', image_url: 'https://picsum.photos/id/106/600/600', sku: 'HF-1L-SS', lead_time: '5-7 days', supplier_tier: 'basic', rating: 4.2 },
      { title: 'Smart LED Bulb 4-Pack', brand: 'Philips', price: 29.00, old_price: 39.00, moq: 36, category: 'home', image_url: 'https://picsum.photos/id/160/600/600', sku: 'PHILIPS-HUE4', lead_time: '5-7 days', supplier_tier: 'gold', rating: 4.5 },
      { title: "Running Shoes - Men's", brand: 'Nike', price: 65.00, old_price: 89.00, moq: 12, category: 'sports', image_url: 'https://picsum.photos/id/1033/600/600', sku: 'NIKE-RUNV2', lead_time: '2-4 days', supplier_tier: 'platinum', rating: 4.8 },
      { title: 'Protein Powder 2kg Whey', brand: 'Optimum Nutrition', price: 42.00, old_price: 55.00, moq: 18, category: 'health', image_url: 'https://picsum.photos/id/292/600/600', sku: 'ON-WHEY2KG', lead_time: '4-6 days', supplier_tier: 'platinum', rating: 4.7 },
      { title: 'Wireless Mouse Ergonomic', brand: 'Logitech', price: 22.00, old_price: 29.00, moq: 48, category: 'office', image_url: 'https://picsum.photos/id/201/600/600', sku: 'LOGI-MX3', lead_time: '3-5 days', supplier_tier: 'basic', rating: 4.1 },
      { title: 'Organic Coffee Beans 5kg', brand: 'Starbucks', price: 78.00, old_price: 95.00, moq: 20, category: 'grocery', image_url: 'https://picsum.photos/id/1060/600/600', sku: 'SB-COFFEE5', lead_time: '10-14 days', supplier_tier: 'gold', rating: 4.4 },
      { title: 'Vitamin C Brightening Serum', brand: 'The Ordinary', price: 9.50, old_price: 14.00, moq: 48, category: 'beauty', image_url: 'https://picsum.photos/id/1080/600/600', sku: 'TO-VITC30', lead_time: '5-7 days', supplier_tier: 'gold', rating: 4.6 },
      { title: 'Wireless Car Vacuum Cleaner', brand: 'Black+Decker', price: 28.00, old_price: 39.00, moq: 20, category: 'automotive', image_url: 'https://picsum.photos/id/1071/600/600', sku: 'BD-CV12', lead_time: '6-9 days', supplier_tier: 'basic', rating: 4.3 }
    ]
  };

  /* ----------------------------------------------------------
     PRODUCTION SWAP (optional):
     Replace the static `products` array above with a Firestore
     fetch, e.g.:

       const snap = await firebase.firestore().collection('products')
                        .where('status','==','active').get();
       window.PSE_CATALOG_DATA.products = snap.docs.map(d => d.data());

     The generator and page already work with whatever shape
     matches the CSV columns above.
     ---------------------------------------------------------- */
})();
