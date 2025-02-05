declare module 'react-plantuml' {
    interface PlantUMLProps {
      value: string
      format?: 'svg' | 'png'
    }
    
    const PlantUML: React.FC<PlantUMLProps>
    export default PlantUML
  }