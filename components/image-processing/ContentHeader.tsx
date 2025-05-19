'use client'

interface ContentHeaderProps {
  title: string
}

export const ContentHeader = ({
  title,
}: ContentHeaderProps) => {
  return (
    <h2 className="text-lg font-medium">{title}</h2>
  )
} 