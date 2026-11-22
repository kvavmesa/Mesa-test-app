import { useEffect, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost/shop-api";
const KHQR_IMAGE_URL = import.meta.env.VITE_KHQR_IMAGE_URL || "/khqr.png";

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "The request could not be completed.");
  }

  return data;
}

function formatPrice(value) {
  return `$${Number(value).toFixed(2)}`;
}

function formatOrderDate(value) {
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
  });
  const [shippingMethod, setShippingMethod] = useState("standard");
  const [page, setPage] = useState("products");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [orderConfirmation, setOrderConfirmation] = useState(null);
  const [qrImageUnavailable, setQrImageUnavailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      setLoading(true);
      setLoadError("");

      try {
        const data = await requestJson(`${API_URL}/get_products.php`, {
          signal: controller.signal,
        });

        if (!Array.isArray(data)) {
          throw new Error("The product list returned by the server is invalid.");
        }

        setProducts(data);
      } catch (error) {
        if (error.name !== "AbortError") {
          setLoadError(
            "Could not load products. Check that Apache and MySQL are running and the shop API is installed."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadProducts();
    return () => controller.abort();
  }, [reloadKey]);

  const totalItems = cart.reduce((total, item) => total + item.qty, 0);
  const subtotal = cart.reduce(
    (total, item) => total + Number(item.price) * item.qty,
    0
  );
  const shippingCost = shippingMethod === "express" ? 10 : 0;
  const grandTotal = subtotal + shippingCost;

  function addToCart(product) {
    setOrderConfirmation(null);
    setCheckoutError("");
    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.id === product.id);

      if (existingItem) {
        return currentCart.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }

      return [...currentCart, { ...product, qty: 1 }];
    });
  }

  function updateQuantity(id, change) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === id ? { ...item, qty: item.qty + change } : item
        )
        .filter((item) => item.qty > 0)
    );
  }

  function removeFromCart(id) {
    setCart((currentCart) => currentCart.filter((item) => item.id !== id));
  }

  function updateCustomer(event) {
    const { name, value } = event.target;
    setCustomer((currentCustomer) => ({
      ...currentCustomer,
      [name]: value,
    }));
  }

  async function handleCheckout(event) {
    event.preventDefault();

    if (cart.length === 0 || submitting) {
      return;
    }

    setSubmitting(true);
    setCheckoutError("");

    try {
      const result = await requestJson(`${API_URL}/checkout.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          shipping_method: shippingMethod,
          payment_method: "khqr",
          items: cart.map(({ id, qty }) => ({ id, qty })),
        }),
      });

      setOrderConfirmation(result);
      setQrImageUnavailable(false);
      setCart([]);
      setPage("confirmation");
    } catch (error) {
      setCheckoutError(error.message || "Checkout failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app">
      <header className="navbar">
        <a
          className="brand"
          href="#products"
          onClick={(event) => {
            event.preventDefault();
            setPage("products");
          }}
        >
          <span className="brand-icon" aria-hidden="true">
            S
          </span>
          <span>Simple Tech</span>
        </a>

        <nav className="nav-links" aria-label="Main navigation">
          <button
            className={page === "products" ? "nav-button active" : "nav-button"}
            aria-current={page === "products" ? "page" : undefined}
            onClick={() => setPage("products")}
          >
            Products
          </button>
          <button
            className={page === "cart" ? "nav-button active" : "nav-button"}
            aria-current={page === "cart" ? "page" : undefined}
            onClick={() => setPage("cart")}
          >
            Cart <span className="cart-count">{totalItems}</span>
          </button>
        </nav>
      </header>

      <main
        className={
          page === "checkout" ? "container checkout-page-container" : "container"
        }
      >
        {page === "products" ? (
          <section aria-labelledby="products-heading">
            <div className="catalog-heading" id="collection">
              <div>
                <h1 id="products-heading">Shop our products</h1>
              </div>
            </div>

            {loading ? (
              <p className="status-message" role="status">
                Loading products…
              </p>
            ) : loadError ? (
              <div className="notice error-notice" role="alert">
                <p>{loadError}</p>
                <button
                  className="secondary-button"
                  onClick={() => setReloadKey((key) => key + 1)}
                >
                  Try again
                </button>
              </div>
            ) : products.length === 0 ? (
              <p className="status-message">No products are available.</p>
            ) : (
              <div className="product-grid">
                {products.map((product) => (
                  <article className="product-card" key={product.id}>
                    <div className="product-image">
                      <img
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                      />
                    </div>
                    <div className="product-details">
                      <h2>{product.name}</h2>
                      <p className="product-description">
                        {product.description}
                      </p>
                      <div className="product-purchase">
                        <span className="product-price">
                          {formatPrice(product.price)}
                        </span>
                        <button
                          className="primary-button add-button"
                          onClick={() => addToCart(product)}
                        >
                          <span aria-hidden="true">+</span> Add to Cart
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : page === "cart" ? (
          <section aria-labelledby="cart-heading">
            <div className="page-heading cart-heading">
              <p className="eyebrow">Your selections</p>
              <h1 id="cart-heading">Shopping Cart</h1>
              <p className="subtitle">
                {totalItems} {totalItems === 1 ? "item" : "items"} in your cart
              </p>
            </div>

            {checkoutError && (
              <div className="notice error-notice" role="alert">
                {checkoutError}
              </div>
            )}

            {cart.length === 0 ? (
              <div className="empty-cart">
                <div className="empty-cart-icon" aria-hidden="true">
                  🛒
                </div>
                <h2>Your cart is empty</h2>
                <p>Looks like you haven&apos;t added anything yet.</p>
                <button
                  className="primary-button"
                  onClick={() => setPage("products")}
                >
                  Browse Products
                </button>
              </div>
            ) : (
              <div className="cart-layout">
                <div className="cart-items">
                  {cart.map((item) => (
                    <article className="cart-item" key={item.id}>
                      <div className="cart-product-image">
                        <img src={item.image} alt="" />
                      </div>
                      <div className="cart-product-info">
                        <h2>{item.name}</h2>
                        <p>{formatPrice(item.price)} each</p>
                      </div>
                      <div
                        className="quantity-control"
                        aria-label={`${item.name} quantity`}
                      >
                        <button
                          aria-label={`Decrease ${item.name} quantity`}
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          −
                        </button>
                        <span aria-live="polite">{item.qty}</span>
                        <button
                          aria-label={`Increase ${item.name} quantity`}
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          +
                        </button>
                      </div>
                      <strong className="line-total">
                        {formatPrice(Number(item.price) * item.qty)}
                      </strong>
                      <button
                        className="remove-button"
                        aria-label={`Remove ${item.name} from cart`}
                        onClick={() => removeFromCart(item.id)}
                      >
                        Remove
                      </button>
                    </article>
                  ))}
                  <button
                    className="text-button continue-button"
                    onClick={() => setPage("products")}
                  >
                    ← Continue shopping
                  </button>
                </div>

                <aside className="order-summary" aria-labelledby="summary-title">
                  <h2 id="summary-title">Order Summary</h2>
                  <div className="summary-row">
                    <span>Items ({totalItems})</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Shipping</span>
                    <span className={shippingCost === 0 ? "free-shipping" : ""}>
                      {shippingCost === 0 ? "Free" : formatPrice(shippingCost)}
                    </span>
                  </div>
                  <div className="summary-total">
                    <span>Grand Total</span>
                    <strong>{formatPrice(grandTotal)}</strong>
                  </div>
                  <button
                    className="primary-button checkout-button"
                    onClick={() => {
                      setCheckoutError("");
                      setPage("checkout");
                    }}
                  >
                    Proceed to Checkout
                    <span aria-hidden="true">→</span>
                  </button>
                  <p className="secure-note">
                    Your order will be saved to the shop database.
                  </p>
                </aside>
              </div>
            )}
          </section>
        ) : page === "checkout" ? (
          <section aria-labelledby="checkout-heading">
            <div className="page-heading cart-heading">
              <p className="eyebrow">Almost yours</p>
              <h1 id="checkout-heading">Checkout</h1>
              <p className="subtitle">
                Enter your details and choose a delivery method.
              </p>
            </div>

            {checkoutError && (
              <div className="notice error-notice" role="alert">
                {checkoutError}
              </div>
            )}

            <form className="checkout-layout" onSubmit={handleCheckout}>
              <div className="checkout-details">
                <section className="checkout-card" aria-labelledby="customer-title">
                  <div className="checkout-section-heading">
                    <span>01</span>
                    <div>
                      <h2 id="customer-title">Customer information</h2>
                      <p>We&apos;ll use these details for your order.</p>
                    </div>
                  </div>

                  <div className="form-grid">
                    <label className="form-field">
                      <span>First name</span>
                      <input
                        autoComplete="given-name"
                        name="firstName"
                        value={customer.firstName}
                        onChange={updateCustomer}
                        maxLength={100}
                        required
                      />
                    </label>
                    <label className="form-field">
                      <span>Last name</span>
                      <input
                        autoComplete="family-name"
                        name="lastName"
                        value={customer.lastName}
                        onChange={updateCustomer}
                        maxLength={100}
                        required
                      />
                    </label>
                    <label className="form-field">
                      <span>Email address</span>
                      <input
                        autoComplete="email"
                        type="email"
                        name="email"
                        value={customer.email}
                        onChange={updateCustomer}
                        maxLength={254}
                        required
                      />
                    </label>
                    <label className="form-field">
                      <span>Phone number</span>
                      <input
                        autoComplete="tel"
                        type="tel"
                        name="phone"
                        value={customer.phone}
                        onChange={updateCustomer}
                        inputMode="tel"
                        maxLength={20}
                        required
                      />
                    </label>
                    <label className="form-field full-width">
                      <span>Address</span>
                      <textarea
                        autoComplete="street-address"
                        name="address"
                        value={customer.address}
                        onChange={updateCustomer}
                        rows={3}
                        maxLength={500}
                        required
                      />
                    </label>
                  </div>
                </section>

                <fieldset className="checkout-card shipping-card">
                  <legend className="visually-hidden">Shipping method</legend>
                  <div className="checkout-section-heading">
                    <span>02</span>
                    <div>
                      <h2>Shipping method</h2>
                      <p>Choose how quickly you&apos;d like your order.</p>
                    </div>
                  </div>

                  <div className="shipping-options">
                    <label
                      className={
                        shippingMethod === "standard"
                          ? "shipping-option selected"
                          : "shipping-option"
                      }
                    >
                      <input
                        type="radio"
                        name="shippingMethod"
                        value="standard"
                        checked={shippingMethod === "standard"}
                        onChange={() => setShippingMethod("standard")}
                      />
                      <span className="shipping-option-copy">
                        <strong>Standard delivery</strong>
                        <span>3–5 business days</span>
                      </span>
                      <strong className="shipping-option-price">Free</strong>
                    </label>
                    <label
                      className={
                        shippingMethod === "express"
                          ? "shipping-option selected"
                          : "shipping-option"
                      }
                    >
                      <input
                        type="radio"
                        name="shippingMethod"
                        value="express"
                        checked={shippingMethod === "express"}
                        onChange={() => setShippingMethod("express")}
                      />
                      <span className="shipping-option-copy">
                        <strong>Express delivery</strong>
                        <span>1–2 business days</span>
                      </span>
                      <strong className="shipping-option-price">
                        {formatPrice(10)}
                      </strong>
                    </label>
                  </div>
                </fieldset>
              </div>

              <aside
                className="order-summary checkout-summary"
                aria-labelledby="checkout-summary-title"
              >
                <h2
                  className="checkout-summary-heading"
                  id="checkout-summary-title"
                >
                  <span>Order Summary</span>
                  <span className="payment-method-tag">
                    <span>QR</span> Bakong KHQR
                  </span>
                </h2>
                <div className="checkout-summary-items">
                  {cart.map((item) => (
                    <div className="checkout-summary-item" key={item.id}>
                      <span>
                        {item.name} <span>× {item.qty}</span>
                      </span>
                      <strong>
                        {formatPrice(Number(item.price) * item.qty)}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="summary-row">
                  <span>Shipping</span>
                  <span>
                    {shippingCost === 0 ? "Free" : formatPrice(shippingCost)}
                  </span>
                </div>
                <div className="summary-total">
                  <span>Grand Total</span>
                  <strong>{formatPrice(grandTotal)}</strong>
                </div>
                <button
                  className="primary-button checkout-button"
                  type="submit"
                  disabled={submitting || cart.length === 0}
                >
                  {submitting ? "Placing Order…" : "Place Order"}
                  {!submitting && <span aria-hidden="true">→</span>}
                </button>
                <button
                  className="text-button back-to-cart"
                  type="button"
                  onClick={() => setPage("cart")}
                >
                  ← Back to cart
                </button>
                <p className="secure-note">
                  Bakong KHQR · payment stays pending until verified.
                </p>
              </aside>
            </form>
          </section>
        ) : (
          <section className="confirmation-page" aria-labelledby="confirmation-heading">
            <div className="confirmation-header">
              <span className="confirmation-check" aria-hidden="true">
                ✓
              </span>
              <div>
                <p className="eyebrow">Order confirmation</p>
                <h1 id="confirmation-heading">Order Placed Successfully!</h1>
                <p className="subtitle">
                  Thank you, {orderConfirmation.customer_name}. Your order is
                  being prepared.
                </p>
              </div>
              <span className="order-status-badge">
                {orderConfirmation.status}
              </span>
            </div>

            <div className="confirmation-layout">
              <div className="confirmation-card">
                <div className="confirmation-details">
                  <div>
                    <span>Order ID</span>
                    <strong>{orderConfirmation.order_number}</strong>
                  </div>
                  <div>
                    <span>Customer Name</span>
                    <strong>{orderConfirmation.customer_name}</strong>
                  </div>
                  <div>
                    <span>Order Date</span>
                    <strong>
                      {formatOrderDate(orderConfirmation.order_date)}
                    </strong>
                  </div>
                  <div>
                    <span>Order Status</span>
                    <strong className="status-text">
                      {orderConfirmation.status}
                    </strong>
                  </div>
                </div>

                <div className="ordered-products">
                  <h2>Ordered Products</h2>
                  {orderConfirmation.items.map((item) => (
                    <article className="ordered-product" key={item.id}>
                      <img src={item.image} alt="" />
                      <div className="ordered-product-info">
                        <strong>{item.name}</strong>
                        <span>
                          {item.qty} × {formatPrice(item.price)}
                        </span>
                      </div>
                      <strong>{formatPrice(item.subtotal)}</strong>
                    </article>
                  ))}
                </div>
              </div>

              <aside className="confirmation-total-card">
                <p>Total Amount</p>
                <strong>{formatPrice(orderConfirmation.grand_total)}</strong>
                <div className="confirmation-total-row">
                  <span>Shipping</span>
                  <span>
                    {Number(orderConfirmation.shipping_cost) === 0
                      ? "Free"
                      : formatPrice(orderConfirmation.shipping_cost)}
                  </span>
                </div>
                <div className="qr-payment">
                  <h2>{orderConfirmation.payment_method}</h2>
                  {qrImageUnavailable ? (
                      <div className="qr-image-placeholder" role="status">
                        <strong>Merchant QR not added</strong>
                        <span>
                          Add your real KHQR image as <code>public/khqr.png</code>.
                        </span>
                      </div>
                  ) : (
                      <img
                        className="khqr-image"
                        src={KHQR_IMAGE_URL}
                        alt="Bakong KHQR payment code"
                        onError={() => setQrImageUnavailable(true)}
                      />
                  )}
                  <p>
                      Scan with Bakong and pay {formatPrice(orderConfirmation.grand_total)}.
                      Payment is not automatically verified by this store.
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setPage("products")}
                >
                  Continue Shopping
                </button>
              </aside>
            </div>
          </section>
        )}
      </main>

      <footer className={page === "checkout" ? "footer checkout-footer" : "footer"}>
        <span>Simple Tech Shop</span>
        <span>Thoughtful tech for your everyday setup.</span>
      </footer>
    </div>
  );
}

export default App;
