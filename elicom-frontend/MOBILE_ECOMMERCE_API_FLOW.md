# World Cart E-Commerce API Flow (Mobile Integration)

This document outlines the end-to-end API flow for the World Cart mobile application, from viewing product details to completing an order.

---

## 🚀 The Order Placement Flow (Step-by-Step)

To successfully place an order without getting a **"Cart is Empty"** error, the developer MUST follow this exact sequence:

### Step 1: Registration (Optional for existing users)
If the user is new, they must register as either a **Customer** or a **Seller**.
- **Customer Registration**: `POST /api/services/app/Account/RegisterSmartStoreCustomer`
- **Seller Registration**: `POST /api/services/app/Account/RegisterSmartStoreSeller`
- **Request Body**:
  ```json
  {
    "fullName": "John Doe",
    "emailAddress": "john@example.com",
    "password": "Password123!",
    "phoneNumber": "+923001234567",
    "country": "Pakistan"
  }
  ```
- **Note**: After registration, the user will receive a **World Cart** themed verification email.

### Step 2: Authentication
Before doing anything with the cart or orders, the user must be logged in.
- **Login**: `POST /api/TokenAuth/Authenticate`
- **Mandatory Headers**: `Abp-TenantId: 1`
- **Result**: Store the `accessToken` (Bearer token) and the `userId`. You will need these for every subsequent step.

### Step 3: Fetch Product Details
When a user clicks a product in the grid, get its unique IDs.
- **Endpoint**: `GET /api/services/app/Homepage/GetProductDetail`
- **Params**: `productId` and `storeProductId`.
- **Purpose**: Get the current price, stock, and variations (colors/sizes).

### Step 4: Add to Cart (CRITICAL)
**If you skip this step, Step 6 will fail with "Cart is Empty".**
The backend converts the current items in the user's "Cart" table into an "Order".
- **Endpoint**: `POST /api/services/app/Cart/AddToCart`
- **Payload**:
  ```json
  {
    "userId": 123,
    "storeProductId": "uuid-from-step-2",
    "quantity": 1
  }
  ```
- **Note**: Ensure you receive a `200 OK` or `success: true`.

### Step 5: Validate Cart (Optional but Recommended)
Before showing the checkout screen, check what's in the backend cart.
- **Endpoint**: `GET /api/services/app/Cart/GetCartItems?userId=123`
- **Purpose**: Confirms the items are actually saved on the server.

### Step 6: Card Validation (Required for Card Payments)
If the user selects "Card" as the payment method, you should validate the card details before calling the "Create Order" API.
- **Endpoint**: `POST /api/services/app/Card/ValidateCard`
- **Payload**:
  ```json
  {
    "cardNumber": "1234123412341234",
    "expiryDate": "12/26",
    "cvv": "123",
    "amount": 100.0
  }
  ```
- **Response**: `{ "result": { "isValid": true, "message": "Success", "availableBalance": 5000 } }`

### Step 7: Place Order (Create Order)
Once the items are in the cart and the user provides their shipping info:
- **Endpoint**: `POST /api/services/app/Order/Create`
- **Headers**: 
    - `Authorization: Bearer {TOKEN}`
    - `Abp-TenantId: 1`
- **Payload**:
  ```json
  {
    "userId": 123,
    "paymentMethod": "Card",
    "cardNumber": "1234...", 
    "expiryDate": "12/26",
    "cvv": "123",
    "shippingAddress": "House 1, Street 2",
    "country": "Pakistan",
    "state": "Punjab",
    "city": "Lahore",
    "postalCode": "54000",
    "recipientName": "Client Name",
    "recipientPhone": "03001112233",
    "sourcePlatform": "Mobile-App"
  }
  ```
- **Backend Behavior**: The system will automatically grab all items from the `Cart` table for `userId: 123`, create an `Order` record, and then **clear the cart**.

---

## ❌ Troubleshooting: "Cart is Empty" Error

If the mobile developer sees a "Cart is Empty" error during Step 7, check the following:

1.  **Was AddToCart successful?**: Verify that `POST /api/services/app/Cart/AddToCart` was called **before** `Create Order`.
2.  **Matching User IDs**: Ensure the `userId` passed in `AddToCart` is exactly the same as the one passed in `Order/Create`.
3.  **Authentication Headers**: Ensure the `Authorization` bearer token is included in the `Order/Create` call. The backend needs this to identify the user session.
4.  **Tenant ID**: Double-check that `Abp-TenantId: 1` is in the headers of BOTH calls. If one uses a different tenant, the carts will be separated.
5.  **Multi-Device Sync**: If the user added items to the cart but didn't log in, those items are only "local". In mobile, **always log in first** before adding to the cart to ensure backend persistence.

---

## 🛠️ Key Endpoints Summary

| Feature | Method | Endpoint |
| :--- | :--- | :--- |
| **Product Detail** | `GET` | `/api/services/app/Homepage/GetProductDetail` |
| **Add to Cart** | `POST` | `/api/services/app/Cart/AddToCart` |
| **Fetch Cart** | `GET` | `/api/services/app/Cart/GetCartItems` |
| **Place Order** | `POST` | `/api/services/app/Order/Create` |
| **Track Order** | `GET` | `/api/services/app/Order/Get` |

---

## 🛠️ Data Types (TypeScript Reference)

```typescript
export interface CreateOrderDto {
    userId: number;
    paymentMethod: string;
    shippingAddress: string;
    country: string;
    state: string;
    city: string;
    postalCode: string;
    recipientName?: string;
    recipientPhone?: string;
    recipientEmail?: string;
    shippingCost: number;
    discount: number;
    sourcePlatform?: string;
}
```
