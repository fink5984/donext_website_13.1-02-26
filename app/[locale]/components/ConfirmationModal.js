"use client";

import React from "react";
import Button from "./Button";
import X from "@/app/icons/x.svg";

const ConfirmationModal = ({
  isOpen = false,
  onClose,
  onConfirm,
  title = "",
  highlightText = "",
  confirmText = "הסרה",
  cancelText = "חזרה",
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="flex relative flex-col justify-center items-center px-6 py-12 bg-white rounded-2xl max-w-[684px] min-h-[234px] shadow-[0px_106px_30px_rgba(62,101,193,0)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-0 w-6 h-6"
          aria-label="Close modal"
        >
          <X />
        </button>

        <div
          id="modal-title"
          className="z-0 text-2xl leading-none text-center text-blue-700"
        >
          {title}
          {highlightText && (
            <span className="font-bold"> {highlightText} </span>
          )}
        </div>

        <div className="flex z-0 flex-wrap gap-10 justify-center items-center mt-16 text-base leading-none text-right text-blue-400 whitespace-nowrap max-md:mt-10 max-md:max-w-full">
          <Button
            onClick={onConfirm}
            text={confirmText}
            className="gap-0.5 self-stretch px-5 py-4 my-auto bg-white rounded-3xl border border-blue-400 border-solid min-h-12 min-w-[280px] w-[280px]"
          />
          <Button
            onClick={onClose}
            text={cancelText}
            className="gap-0.5 self-stretch px-5 py-4 my-auto bg-white rounded-3xl border border-blue-400 border-solid min-h-12 min-w-[280px] w-[280px]"
          />
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
