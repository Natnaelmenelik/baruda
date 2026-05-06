'use client';

import toast from 'react-hot-toast';

export const notify = {
  loading(message: string, id?: string) {
    return toast.loading(message, id ? { id } : undefined);
  },

  success(message: string, id?: string) {
    return toast.success(message, id ? { id } : undefined);
  },

  error(message: string, id?: string) {
    return toast.error(message, id ? { id } : undefined);
  },

  info(message: string) {
    return toast(message);
  },

  dismiss(id?: string) {
    toast.dismiss(id);
  },
};
