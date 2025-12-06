"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye } from 'lucide-react';
import type { Product } from '@/types/product';

interface ProductCardProps {
  product: Product;
  cardBackground?: string;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, cardBackground = 'bg-white' }) => {
  const { slug, title, price, images, inStock } = product;
  const isSoldOut = inStock === false;
  const [imgLoaded, setImgLoaded] = React.useState(false);

  return (
    <div className={`${cardBackground} rounded-md shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col`}>
      <Link href={`/products/${slug}`} className="block">
        <div className="relative w-full h-48">
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-200 animate-pulse rounded-t-md z-10">
              <div className="h-12 w-12 bg-gray-300 rounded-full" />
            </div>
          )}
          <Image
            src={images[0]}
            alt={title}
            fill
            className={`object-cover rounded-t-md transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'} ${isSoldOut ? 'opacity-50' : ''}`}
            sizes="(max-width: 768px) 50vw, 33vw"
            loading="lazy"
            unoptimized
            onLoadingComplete={() => setImgLoaded(true)}
          />
          {isSoldOut && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-t-md">
              <div className="bg-red-600 border-2 border-red-700 rounded-xl px-6 py-3 shadow-2xl transform rotate-[-2deg]">
                <span className="sold-out-badge text-white text-sm font-black uppercase tracking-widest whitespace-nowrap drop-shadow-lg">
                  Sold Out
                </span>
              </div>
            </div>
          )}
        </div>
      </Link>
      <div className="p-4 flex-grow flex flex-col">
        <h3 className="text-lg font-medium text-gray-900 line-clamp-2 sm:line-clamp-1">
          {title}
        </h3>
        <div className="mt-auto pt-2 flex flex-col gap-2">
          <span className="text-xl font-bold text-gray-900">${new Intl.NumberFormat('en-US').format(price)}</span>
          <Link href={`/products/${slug}`} className="flex items-center text-sm text-gray-500">
            <Eye className="h-4 w-4 mr-1" />
            <span>View Details</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;