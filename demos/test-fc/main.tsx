import React, { useState } from 'react'
import ReactDOM from 'react-dom'

function App() {
  const [num] = useState(1000)
  return <div>{num}</div>
}

const root = ReactDOM.createRoot(document.getElementById('root'))

root.render(<App />)

console.log('%c [ React ]-2', 'font-size:13px; background:#e02a35; color:#ff6e79;', React)

console.log('%c [ ReactDOM ]-3', 'font-size:13px; background:#49ed40; color:#8dff84;', ReactDOM)
