import { Modal, ModalProps, Popconfirm } from 'antd'
import TextArea from 'antd/es/input/TextArea'
import { TextAreaProps } from 'antd/lib/input'
import { TextAreaRef } from 'antd/lib/input/TextArea'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { TopView } from '../TopView'

interface ShowParams {
  text: string
  textareaProps?: TextAreaProps
  modalProps?: ModalProps
  messageId?: string
  topicId?: string
  index?: number
  children?: (props: { onOk?: () => void; onCancel?: () => void; onRollback?: () => void }) => React.ReactNode
}

interface Props extends ShowParams {
  resolve: (data: any) => void
}

const PopupContainer: React.FC<Props> = ({
  text,
  textareaProps,
  modalProps,
  messageId,
  topicId,
  index,
  resolve,
  children
}) => {
  const [open, setOpen] = useState(true)
  const { t } = useTranslation()
  const [textValue, setTextValue] = useState(text)
  const textareaRef = useRef<TextAreaRef>(null)

  const onOk = () => {
    setOpen(false)
    resolve(textValue)
  }

  const onCancel = () => {
    setOpen(false)
  }

  const onClose = () => {
    resolve(null)
  }

  // 一键回档功能 - 删除当前消息之后的所有消息
  const onRollback = () => {
    if (topicId && messageId && index !== undefined) {
      // 一键回档功能实现

      // 获取当前消息在Redux store中的索引
      // 关闭编辑弹窗
      setOpen(false)

      // 返回编辑后的文本
      resolve({ text: textValue, rollback: true, messageId, index })
    } else {
      console.error('无法执行一键回档：缺少必要参数')
    }
  }

  const resizeTextArea = () => {
    const textArea = textareaRef.current?.resizableTextArea?.textArea
    const maxHeight = innerHeight * 0.6
    if (textArea) {
      textArea.style.height = 'auto'
      textArea.style.height = textArea?.scrollHeight > maxHeight ? maxHeight + 'px' : `${textArea?.scrollHeight}px`
    }
  }

  useEffect(() => {
    setTimeout(resizeTextArea, 0)
  }, [])

  const handleAfterOpenChange = (visible: boolean) => {
    if (visible) {
      const textArea = textareaRef.current?.resizableTextArea?.textArea
      if (textArea) {
        textArea.focus()
        const length = textArea.value.length
        textArea.setSelectionRange(length, length)
      }
    }
  }

  TextEditPopup.hide = onCancel

  return (
    <Modal
      title={t('common.edit')}
      width="60vw"
      style={{ maxHeight: '70vh' }}
      transitionName="animation-move-down"
      okText={t('common.save')}
      {...modalProps}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      afterClose={onClose}
      afterOpenChange={handleAfterOpenChange}
      centered
      footer={[
        <Popconfirm
          key="rollback"
          title="确定要执行一键回档吗？这将删除此消息之后的所有消息"
          onConfirm={onRollback}
          okText="确定"
          cancelText="取消"
          disabled={!topicId || !messageId || index === undefined}>
          <RollbackButton disabled={!topicId || !messageId || index === undefined}>
            {t('common.rollback')}
          </RollbackButton>
        </Popconfirm>,
        <CancelButton key="cancel" onClick={onCancel}>
          {t('common.cancel')}
        </CancelButton>,
        <SaveButton key="ok" onClick={onOk}>
          {t('common.save')}
        </SaveButton>
      ]}>
      <TextArea
        ref={textareaRef}
        rows={2}
        autoFocus
        spellCheck={false}
        {...textareaProps}
        value={textValue}
        onInput={resizeTextArea}
        onChange={(e) => setTextValue(e.target.value)}
      />
      <ChildrenContainer>{children && children({ onOk, onCancel, onRollback })}</ChildrenContainer>
    </Modal>
  )
}

const TopViewKey = 'TextEditPopup'

const ChildrenContainer = styled.div`
  position: relative;
`

const RollbackButton = styled.button`
  padding: 4px 15px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background-color: transparent;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-error);
  transition: all 0.3s;

  &:hover {
    border-color: var(--color-error);
    color: var(--color-error);
  }

  &:disabled {
    color: var(--color-text-3);
    border-color: var(--color-border);
    cursor: not-allowed;
  }
`

const CancelButton = styled.button`
  padding: 4px 15px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background-color: transparent;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text);
  transition: all 0.3s;
  margin-left: 8px;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`

const SaveButton = styled.button`
  padding: 4px 15px;
  border-radius: 6px;
  border: 1px solid var(--color-primary);
  background-color: var(--color-primary);
  cursor: pointer;
  font-size: 14px;
  color: white;
  transition: all 0.3s;
  margin-left: 8px;

  &:hover {
    opacity: 0.8;
  }
`

export default class TextEditPopup {
  static topviewId = 0
  static hide() {
    TopView.hide(TopViewKey)
  }
  static show(props: ShowParams) {
    return new Promise<any>((resolve) => {
      TopView.show(
        <PopupContainer
          {...props}
          resolve={(v) => {
            resolve(v)
            TopView.hide(TopViewKey)
          }}
        />,
        TopViewKey
      )
    })
  }
}
