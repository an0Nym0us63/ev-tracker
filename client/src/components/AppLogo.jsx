import React from 'react'

export default function AppLogo({ size = 64, style = {} }) {
  return (
    <img
      src="/logo.svg"
      alt="EV Tracker"
      style={{ width: size, height: size, borderRadius: size * 0.22, ...style }}
    />
  )
}
