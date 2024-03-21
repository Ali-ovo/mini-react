import React, { useState } from 'react'
import ReactDOM from 'react-dom'

function App() {
  const [num, setNum] = useState(1)

  const arr =
    num % 2 === 0
      ? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
      : [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>]

  return (
    <ul
      onClick={() => {
        setNum(num => num + 1)
        setNum(num => num + 1)
        setNum(num => num + 1)
      }}
    >
      <>
        <li>1</li>
        <li>2</li>
      </>
      <li>3</li>
      <li>4</li>
      {arr}
    </ul>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root'))

root.render(<App />)
