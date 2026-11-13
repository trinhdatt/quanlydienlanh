import React, { useEffect, useRef } from 'react';

export default function Modal({ close, title, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="mg-modal" aria-label={title} onCancel={event => {
    event.preventDefault();
    close();
  }}>
    <header><h2>{title}</h2><button type="button" aria-label="Đóng" onClick={close}>×</button></header>
    {children}
  </dialog>;
}
