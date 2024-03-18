import { FiberNode } from 'react-reconciler/src/fiber'
import { HostText } from 'react-reconciler/src/workTags'

export type Container = Element
export type Instance = Element
export type TextInstance = Text

// export const createInstance = (type: string, props: any): Instance => {
export const createInstance = (type: string, props: any): Instance => {
  // TODO: props
  const element = document.createElement(type)
  return element
}

export const appendInitialChild = (parent: Instance | Container, child: Instance) => {
  parent.appendChild(child)
}

export const createTextInstance = (content: string) => {
  return document.createTextNode(content)
}

export const appendChildToContainer = appendInitialChild

export const commitUpdate = (fiber: FiberNode) => {
  switch (fiber.tag) {
    case HostText:
      const text = fiber.memoizedProps.content
      return commitTextUpdate(fiber.stateNode, text)

    default:
      if (__DEV__) {
        console.warn('commitUpdate: unknown fiber tag', fiber)
      }
      break
  }
}

export const commitTextUpdate = (textInstance: TextInstance, content: string) => {
  textInstance.textContent = content
}

export const removeChild = (child: Instance | TextInstance, container: Container) => {
  container.removeChild(child)
}
