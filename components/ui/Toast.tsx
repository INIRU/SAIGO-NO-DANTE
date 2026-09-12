'use client'

import { useState, useCallback, useEffect } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react'
import { useLocale } from 'next-intl'

type ToastType = 'success' | 'error' | 'warning'
interface ToastData { message: string; type: ToastType; id: number }
const DURATION = 5000

export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null)
  const showToast = useCallback((message:string,type:ToastType='error')=>setToast({message,type,id:Date.now()}),[])
  useEffect(()=>{
    if(!toast)return
    const timer=setTimeout(()=>setToast(null),DURATION)
    return ()=>clearTimeout(timer)
  },[toast])
  return {toast,showToast}
}

export function Toast({toast}:{toast:ToastData|null}) {
  const locale=useLocale()
  const [dismissed,setDismissed]=useState<number|null>(null)
  if(!toast || toast.id===dismissed)return null
  const Icon=toast.type==='success'?CheckCircle2:toast.type==='warning'?AlertTriangle:XCircle
  const color=toast.type==='success'?'#85bb83':toast.type==='warning'?'var(--gold-light)':'#e48b7f'
  return <div key={toast.id} className="popup-toast" role={toast.type==='error'?'alert':'status'}>
    <Icon size={20} style={{color}} aria-hidden="true"/><span>{toast.message}</span>
    <button type="button" onClick={()=>setDismissed(toast.id)} aria-label={locale==='ko'?'알림 닫기':locale==='ja'?'通知を閉じる':'Dismiss notification'}><X size={16}/></button>
  </div>
}
