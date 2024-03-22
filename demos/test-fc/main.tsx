import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'

function App() {
  const [num, setNum] = useState(0)

  useEffect(() => {
    console.log('App mount')
  }, [])

  useEffect(() => {
    console.log('num change create', num)

    return () => {
      console.log('num change destroy', num)
    }
  }, [num])

  return (
    <ul
      onClick={() => {
        setNum(num => num + 1)
      }}
    >
      {num === 0 ? <Child /> : 'noop'}
    </ul>
  )
}

function Child() {
  useEffect(() => {
    console.log('Child mount')

    return () => {
      console.log('Child unmount')
    }
  })

  return 'i am child'
}

const root = ReactDOM.createRoot(document.getElementById('root'))

root.render(<App />)
