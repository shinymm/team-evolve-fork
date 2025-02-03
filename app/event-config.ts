import { EventEmitter } from 'events'

// 增加默认的最大监听器数量
EventEmitter.defaultMaxListeners = 20 