import 'dayjs/locale/zh-cn'

import { useTheme } from '@renderer/context/ThemeProvider'
import type { CalendarProps } from 'antd'
import { Button, Calendar, Divider, Drawer, Form, Input, Modal, Select, Tag } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { FC, useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

dayjs.locale('zh-cn') // 设置中文

// 日程事件接口
interface CalendarEvent {
  id: string
  title: string
  date: string // ISO 格式的日期字符串
  time?: string // 可选的时间
  description?: string // 可选的描述
  category?: string // 可选的分类
}

// 日历组件属性
interface SimpleCalendarProps {
  events?: CalendarEvent[] // 预设的事件列表
  onAddEvent?: (event: CalendarEvent) => void // 添加事件回调
  onDeleteEvent?: (eventId: string) => void // 删除事件回调
}

// 颜色与分类的映射
const categoryColors = {
  工作: '#1890ff',
  个人: '#52c41a',
  重要: '#f5222d',
  学习: '#722ed1',
  其他: '#faad14'
}

// 分类选项
const categoryOptions = [
  { value: '工作', label: '工作' },
  { value: '个人', label: '个人' },
  { value: '重要', label: '重要' },
  { value: '学习', label: '学习' },
  { value: '其他', label: '其他' }
]

const SimpleCalendar: FC<SimpleCalendarProps> = ({ events = [], onAddEvent, onDeleteEvent }) => {
  const { theme } = useTheme()
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>(events)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [eventForm] = Form.useForm()
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // 组件初始化时，从localStorage加载事件数据
  useEffect(() => {
    const savedEvents = localStorage.getItem('calendarEvents')
    if (savedEvents) {
      setLocalEvents(JSON.parse(savedEvents))
    }
    setInitialLoadDone(true)
  }, [])

  // 当传入的events改变时，更新localEvents
  useEffect(() => {
    if (events.length > 0) {
      setLocalEvents(events)
    }
  }, [events])

  // 当localEvents改变且初始加载完成后，保存到localStorage
  useEffect(() => {
    if (initialLoadDone) {
      localStorage.setItem('calendarEvents', JSON.stringify(localEvents))
    }
  }, [localEvents, initialLoadDone])

  // 处理日期单元格渲染
  const dateCellRender = useCallback(
    (value: Dayjs) => {
      const dateStr = value.format('YYYY-MM-DD')
      const dateEvents = localEvents.filter((event) => event.date === dateStr)

      if (dateEvents.length === 0) return null

      return (
        <EventList>
          {dateEvents.map((event) => (
            <EventItem
              key={event.id}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedEvent(event)
                setIsDrawerOpen(true)
              }}>
              <EventTag
                color={event.category ? categoryColors[event.category as keyof typeof categoryColors] : '#1890ff'}>
                {event.title}
              </EventTag>
            </EventItem>
          ))}
        </EventList>
      )
    },
    [localEvents]
  )

  // 处理日期选择
  const onDateSelect: CalendarProps<Dayjs>['onSelect'] = (date) => {
    setSelectedDate(date)
    setIsModalOpen(true)
    eventForm.setFieldsValue({
      date: date.format('YYYY-MM-DD'),
      time: null,
      title: '',
      description: '',
      category: '其他'
    })
  }

  // 添加新事件
  const handleAddEvent = () => {
    eventForm.validateFields().then((values) => {
      const newEvent: CalendarEvent = {
        id: `event-${Date.now()}`,
        title: values.title,
        date: values.date,
        time: values.time,
        description: values.description,
        category: values.category
      }

      setLocalEvents((prev) => [...prev, newEvent])
      if (onAddEvent) {
        onAddEvent(newEvent)
      }

      setIsModalOpen(false)
      eventForm.resetFields()
    })
  }

  // 删除事件
  const handleDeleteEvent = (eventId: string) => {
    setLocalEvents((prev) => prev.filter((e) => e.id !== eventId))
    if (onDeleteEvent) {
      onDeleteEvent(eventId)
    }
    setIsDrawerOpen(false)
  }

  return (
    <Container theme={theme}>
      <CalendarHeader>
        <h2>简易日历</h2>
        <div>当前日期: {dayjs().format('YYYY年MM月DD日')}</div>
      </CalendarHeader>

      <Calendar
        value={selectedDate}
        onSelect={onDateSelect}
        cellRender={(current, info) => {
          if (info.type === 'date') return dateCellRender(current)
          return info.originNode
        }}
      />

      {/* 添加事件的弹窗 */}
      <Modal
        title="添加日程"
        open={isModalOpen}
        onOk={handleAddEvent}
        onCancel={() => setIsModalOpen(false)}
        destroyOnClose>
        <Form form={eventForm} layout="vertical">
          <Form.Item name="date" label="日期" rules={[{ required: true, message: '请选择日期' }]}>
            <Input disabled />
          </Form.Item>
          <Form.Item name="time" label="时间">
            <Select placeholder="选择时间" allowClear>
              {Array.from({ length: 24 }).map((_, hour) => (
                <Select.Option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                  {hour.toString().padStart(2, '0')}:00
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入日程标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入详细描述（可选）" rows={3} />
          </Form.Item>
          <Form.Item name="category" label="分类" initialValue="其他">
            <Select placeholder="选择分类">
              {categoryOptions.map((option) => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看事件的抽屉 */}
      <Drawer
        title="日程详情"
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        width={360}
        extra={
          <Button type="primary" danger onClick={() => selectedEvent && handleDeleteEvent(selectedEvent.id)}>
            删除日程
          </Button>
        }>
        {selectedEvent && (
          <EventDetails>
            <h3>{selectedEvent.title}</h3>
            <p>
              <strong>日期：</strong> {dayjs(selectedEvent.date).format('YYYY年MM月DD日')}
            </p>
            {selectedEvent.time && (
              <p>
                <strong>时间：</strong> {selectedEvent.time}
              </p>
            )}
            {selectedEvent.category && (
              <p>
                <strong>分类：</strong>
                <Tag color={categoryColors[selectedEvent.category as keyof typeof categoryColors]}>
                  {selectedEvent.category}
                </Tag>
              </p>
            )}
            <Divider />
            {selectedEvent.description ? (
              <p>{selectedEvent.description}</p>
            ) : (
              <p style={{ color: 'rgba(0, 0, 0, 0.45)' }}>没有描述</p>
            )}
          </EventDetails>
        )}
      </Drawer>
    </Container>
  )
}

// 样式组件
const Container = styled.div<{ theme: string }>`
  width: 100%;
  padding: 20px;
  background-color: ${(props) => (props.theme === 'dark' ? 'var(--color-background)' : 'white')};
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`

const CalendarHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h2 {
    margin: 0;
    font-size: 20px;
  }
`

const EventList = styled.div`
  max-height: 60px;
  overflow-y: auto;
  margin-top: 2px;
`

const EventItem = styled.div`
  margin-bottom: 2px;
  cursor: pointer;
`

const EventTag = styled(Tag)`
  width: 100%;
  text-align: center;
  margin-right: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const EventDetails = styled.div`
  h3 {
    margin-top: 0;
    font-size: 18px;
  }
`

export default SimpleCalendar
