import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'

function App() {
  return (
    <>
      <Child />
      <div>hello</div>
    </>
  )
}

function Child() {
  return 'i am child'
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<App />)
