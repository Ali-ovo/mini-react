import { Container } from 'hostConfig'
import { Props } from 'shared/ReactTypes'

type EventCallback = (e: Event) => void

interface SyntheticEvent extends Event {
  __stopPropagation: boolean
}

interface Paths {
  capture: EventCallback[]
  bubble: EventCallback[]
}

export const elementPropsKey = '__props'

const validEventTypeList = ['click']

export interface DOMElement extends Element {
  [elementPropsKey]: Props
}

export function updateFiberProps(node: DOMElement, props: Props) {
  node[elementPropsKey] = props
}

export function initEvent(container: Container, eventType: string) {
  if (!validEventTypeList.includes(eventType)) {
    console.warn(`initEvent: invalid event type "${eventType}"`)
    return
  }

  if (__DEV__) {
    console.log(`initEvent: ${eventType}`)
  }

  container.addEventListener(eventType, (e: Event) => {
    dispatchEvent(container, eventType, e)
  })
}

function createSyntheticEvent(e: Event) {
  const syntheticEvent = e as SyntheticEvent
  syntheticEvent.__stopPropagation = false
  const originStopPropagation = syntheticEvent.stopPropagation

  syntheticEvent.stopPropagation = () => {
    syntheticEvent.__stopPropagation = true
    originStopPropagation.call(syntheticEvent)
  }

  return syntheticEvent
}

function dispatchEvent(container: Container, eventType: string, e: Event) {
  const targetElement = e.target

  if (targetElement === null) {
    console.warn('dispatchEvent: targetElement is null', e)
    return
  }

  // 手机沿途的事件
  const { bubble, capture } = collectPaths(targetElement as DOMElement, container, eventType)

  // 构成合成事件
  const se = createSyntheticEvent(e)

  // 遍历 capture
  triggerEventFlow(capture, se)
  if (!se.__stopPropagation) {
    // 遍历 bubble
    triggerEventFlow(bubble, se)
  }
}

function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
  for (let i = 0; i < paths.length; i++) {
    const callback = paths[i]
    callback.call(null, se)

    if (se.__stopPropagation) {
      break
    }
  }
}

function getEventCallbackNameFromEventType(eventType: string): string[] | undefined {
  return {
    click: ['onClickCapture', 'onClick']
  }[eventType]
}

function collectPaths(targetElement: DOMElement, container: Container, eventType: string) {
  const paths: Paths = {
    capture: [],
    bubble: []
  }

  while (targetElement && targetElement !== container) {
    // 收集
    const elementProps = targetElement[elementPropsKey]
    if (elementProps) {
      const callbackNameList = getEventCallbackNameFromEventType(eventType)

      if (callbackNameList) {
        callbackNameList.forEach((callbackName, i) => {
          const eventCallback = elementProps[callbackName]
          if (eventCallback) {
            if (i === 0) {
              // capture
              paths.capture.unshift(eventCallback)
            } else {
              // bubble
              paths.bubble.push(eventCallback)
            }
          }
        })
      }
    }
    targetElement = targetElement.parentNode as DOMElement
  }

  return paths
}
