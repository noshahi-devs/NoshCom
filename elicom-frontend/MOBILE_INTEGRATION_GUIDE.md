# Mobile Integration Guide (React Native) - World Cart

This document provides instructions for integrating Categories and Products from the World Cart backend into the React Native mobile application.

## 1. General Configuration
- **Base URL**: `https://elicom-api.noshahidev.com` (Example - use the standard `environment.apiUrl`)
- **API Wrapper**: All responses are wrapped in a standard ABP response: `{ "result": { ... }, "success": true, "error": null, "unAuthorizedRequest": false }`. You should always access the `result` property.

---

## 2. Category Integration

### Endpoint
- **URL**: `GET /api/services/app/Category/GetAll?maxResultCount=100`

### Data Model (`Category`)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Unique identifier for the category. |
| `name` | `string` | Display name (e.g., "Men Clothing"). |
| `imageUrl` | `string` | RAW image path (See Section 4 for parsing). |
| `slug` | `string` | URL-friendly name. |

---

## 3. Product Integration

### Endpoint
- **URL**: `GET /api/services/app/Homepage/GetAllProductsForCards?skipCount=0&maxResultCount=20`

### Data Model (`ProductCardDto`)
| Field | Type | Description |
| :--- | :--- | :--- |
| `productId` | `uuid` | Core product ID. |
| `storeProductId` | `uuid` | Specific instance ID in the store. |
| `productName` | `string` | Full name of the product. |
| `price` | `number` | Current selling price. |
| `categoryName` | `string` | Associated category name. |
| `image1` | `string` | Primary image path (Needs Parsing). |
| `image2` | `string` | Secondary/Hover image path (Needs Parsing). |

---

## 4. CRITICAL: Image Path Parsing Logic
The backend often returns image paths in various malformed or stringified formats (JSON arrays, escaped quotes from database exports, etc.). You **must** implement a cleaning utility in React Native.

### JavaScript/TypeScript Utility Example:
```typescript
const resolveImagePath = (rawPath: string) => {
  if (!rawPath || rawPath === 'string' || rawPath.trim() === '') {
    return 'https://via.placeholder.com/300x400?text=No+Image'; 
  }

  let cleaned = rawPath.trim();

  // 1. Remove JSON artifacts (e.g., ["url"], \"url\", or \"[\\\"url\\\"]\")
  cleaned = cleaned
    .replace(/^\["/, '')      // Remove start of array ["
    .replace(/"\]$/, '')      // Remove end of array "]
    .replace(/^\\"/, '')     // Remove escaped start quote \"
    .replace(/\\"$/, '')     // Remove escaped end quote \"
    .replace(/^"/, '')       // Remove start quote "
    .replace(/"$/, '')       // Remove end quote "
    .replace(/\\"/g, '');    // Remove all remaining escaped quotes

  // 2. Handle comma-separated lists (Take the first image)
  if (cleaned.includes('","')) {
    cleaned = cleaned.split('","')[0];
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.split(',')[0];
  }

  cleaned = cleaned.trim();

  // 3. Resolve Absolute vs Relative
  if (cleaned.startsWith('http')) {
    return cleaned;
  }

  // Prepend Base URL (ensure no double slashes)
  const baseUrl = "https://elicom-api.noshahidev.com";
  const path = cleaned.startsWith('/') ? cleaned.substring(1) : cleaned;
  
  return `${baseUrl}/${path}`;
};
```

---

## 5. Implementation Steps for Mobile
1.  **Home Screen Layout**:
    - **Categories**: Use a Horizontal `FlatList` with circular items. Display the `name` and use the utility to resolve `imageUrl`.
    - **Product Grid**: Use a 2-column `FlatList` or `FlashList`.
2.  **Product Navigation**:
    - When a user clicks a product, navigate to `ProductDetailScreen`.
    - Pass **both** `productId` and `storeProductId` to the detail page, as the API requires both for `GetProductDetail`.
3.  **Dynamic Filtering**:
    - When a category is clicked, navigate to a Search/Filtered screen by sending the category name as a filter parameter.

---

## 6. Developer Support
If an image fails to load even after cleaning, check for:
- `cdn.elicom.com` artifacts (replace with a fallback if the CDN is down).
- File extensions: Ensure the extension (e.g., `.jpg`, `.png`) is present after cleaning.
