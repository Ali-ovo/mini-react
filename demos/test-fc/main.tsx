import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-noop-renderer'

function App() {
  // const [num, setNum] = useState(0)
  // useEffect(() => {
  //   console.log('App mount')
  // }, [])
  // useEffect(() => {
  //   console.log('num change create', num)
  //   return () => {
  //     console.log('num change destroy', num)
  //   }
  // }, [num])
  // return (
  //   <ul
  //     onClick={() => {
  //       setNum(num => num + 1)
  //     }}
  //   >
  //     {num === 0 ? <Child /> : 'noop'}
  //   </ul>
  // )

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

// const root = ReactDOM.createRoot(document.getElementById('root'))

const root = ReactDOM.createRoot()
root.render(<App />)

window.root = root
