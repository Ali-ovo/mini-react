import React, { useState } from 'react'
import ReactDOM from 'react-dom'

function App() {
  const [num, setNum] = useState(1)

  window.setNum = setNum
  return num === 3 ? (
    <Child />
  ) : (
    <div
      onClick={() => {
        setNum(num + 1)
      }}
    >
      {num}
    </div>
  )
}

function Child() {
  return <span>my-react</span>
}

const root = ReactDOM.createRoot(document.getElementById('root'))

root.render(<App />)
