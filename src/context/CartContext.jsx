import React, { createContext, useState, useEffect } from 'react';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [total, setTotal] = useState(0);

  // La clave única de cada ítem es "productoId-ptpId"
  const getItemKey = (product) =>
    `${product.id}-${product.selectedPtp?.id ?? 'noptp'}`;

  useEffect(() => {
    const newTotal = cartItems.reduce(
      (acc, item) => acc + (item.selectedPtp?.precio ?? 0) * item.cantidad,
      0
    );
    setTotal(newTotal);
  }, [cartItems]);

  const addToCart = (product) => {
    const key = getItemKey(product);
    setCartItems(prev => {
      const existing = prev.find(item => item._key === key);
      if (existing) {
        return prev.map(item =>
          item._key === key
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...prev, { ...product, _key: key, cantidad: 1 }];
    });
  };

  const removeFromCart = (key) => {
    setCartItems(prev => prev.filter(item => item._key !== key));
  };

  const updateQuantity = (key, newQuantity) => {
    if (newQuantity <= 0) return;
    setCartItems(prev =>
      prev.map(item => item._key === key ? { ...item, cantidad: newQuantity } : item)
    );
  };

  const clearCart = () => setCartItems([]);

  return (
    <CartContext.Provider value={{ cartItems, total, addToCart, removeFromCart, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};
