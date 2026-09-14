import {createRoot} from 'react-dom/client'
import {DocumentationSite} from './DocumentationSite'
import type {Catalog} from '../catalog.ts'
import './style.css'

const catalog: Catalog = JSON.parse(document.getElementById('documentation')!.textContent!)
createRoot(document.getElementById('root')!).render(<DocumentationSite catalog={catalog} />)
