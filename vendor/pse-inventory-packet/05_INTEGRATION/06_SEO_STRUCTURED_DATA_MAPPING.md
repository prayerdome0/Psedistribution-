# Product Structured Data Mapping

| Public field | Product/Offer use | Rule |
|---|---|---|
| title | Product.name | Must match visible title |
| imageUrls | Product.image | Approved HTTPS images only |
| shortDescription | Product.description | Must match visible buyer-safe copy |
| upc | gtin8/12/13/14 | Output only after exact validation |
| condition | itemCondition | Map to supported URL value |
| status | availability | Available/Limited map to InStock; confirm-only requires cautious visible language |
| public*Price | Offer.price | Output only when pricingMode=public |
| currency | priceCurrency | USD at launch |
| fob/freightTerms | visible page content | Do not imply shipping inclusion when freight is quoted separately |

Validate the rendered page with Google's supported structured-data tools during staging and production acceptance.
