import React, { useState } from "react";
import styles from './MTBTicketsEditor.module.css'
import selectIcon from "../../assets/atoms/selectIcon.svg";
import selectIconActive from "../../assets/atoms/selectIconActive.svg";
import { MTBSelector } from "../../components";

const ticketingOptions = [
  { 
    value: 0, 
    name: "External link",
  },
  { 
    value: 1, 
    name: "Free",
  },
  { 
    value: 2, 
    name: "RSVP",
  },
];

const baseTicket = {
  option: 'External link',
  type: '',
  error: false
}

const MTBTicketsEditor = ({ tickets, setTickets, handleContinue, showNext }) => {
  const [ticketSelectedIndex, setTicketSelectedIndex] = useState(0)
  
  const createMultipleClasses = (classes = []) => classes.filter(cl => cl).join(' ');
  


  const changeTicketSelectedAttr = (attr, value) => {
    let selectedTicketCopy = tickets[ticketSelectedIndex]
    selectedTicketCopy = {
      ...selectedTicketCopy,
      [attr]: value
    }
    selectedTicketCopy = validateTicket(selectedTicketCopy)
    let ticketsCopy = JSON.parse(JSON.stringify(tickets))
    ticketsCopy[ticketSelectedIndex] = selectedTicketCopy
    setTickets(ticketsCopy)
  }

  const addNewTicket = () => {
    let ticketsCopy = JSON.parse(JSON.stringify(tickets))
    ticketsCopy.push(Object.assign({}, baseTicket))
    
    setTickets(ticketsCopy)
    setTicketSelectedIndex(ticketsCopy.length - 1)
  }

  const deleteTicket = (ticketIndex) => {
    if(tickets.length === 1) {
      return
    } 
    let ticketsCopy = JSON.parse(JSON.stringify(tickets))
    ticketsCopy.splice(ticketIndex, 1)
    setTickets(ticketsCopy)
    setTicketSelectedIndex(0)
  } 

  const validateTicket = (ticket = {}, index) => {
    let error = false
    if(ticket.option === 'External link') {
      if((!ticket.link1 && !ticket.link2 && !ticket.link3) || !ticket.type) {
        error = true
      }
    } else {
      if(!ticket.type) {
        error = true
      }
    }
    return {
      ...ticket,
      error
    }
  }

  const ticketsValidated = () => {
    let ticketsCopy = JSON.parse(JSON.stringify(tickets))
    ticketsCopy = ticketsCopy.map(ticket => validateTicket(ticket))
    setTickets(ticketsCopy)
    if(ticketsCopy.some(t => t.error)) {
      return false
    }
    return true
  }

  const _handleContinue = () => {
    if(!ticketsValidated()) {
      return
    }
    handleContinue()
  }

 return (
    <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        width: '100%',
        height: '90%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', marginBottom: '30px', height: '100%', alignContent: 'space-between' }}>
        <span className={styles['tickets-viewer-container']}>
          <div className={styles['ticket-list-container']}>
            {tickets.map((ticket, index) => (
              <div
                className={styles['individual-ticket-container']}
              >
                <span
                  style={{
                    width: '100%',
                    display: 'flex',
                    cursor: 'pointer',
                    alignItems: 'center'
                  }}
                  onClick={() => setTicketSelectedIndex(index)}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      background: 'white',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      boxShadow: '0px 0px 0px 4px #98A2B324',
                      marginRight: '10px',
                    }}
                  >
                    <div>
                      <img
                        style={{justifySelf: "flex-end"}}
                        src={ticketSelectedIndex === index ? selectIconActive : selectIcon}
                        alt='bullet'
                      />
                    </div>
                  </div>
                  <div>
                    <div
                      className={
                        createMultipleClasses([
                          styles['outfit-font'],
                        ])
                      }
                      style={{
                        fontWeight: 800,
                        color: ticket.error ? 'red' : ticketSelectedIndex === index ? '#00AAD6' : '#514F4F'
                      }}
                    >
                      Ticket {index <= 8 ? `0${index + 1}` : index + 1}
                    </div>
                    <div className={createMultipleClasses([styles['outfit-font']])}>
                      {ticket.option}
                    </div>
                  </div>
                </span>
                <div className={styles['delete-icon']} onClick={() => deleteTicket(index)}>
                  <span className={createMultipleClasses([
                    'material-symbols-outlined',
                    tickets.length === 1 ? styles['disabled'] : ''
                  ])}>
                    delete
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div
            className={createMultipleClasses([styles['add-another-ticket-container'], styles['primary-color']])}
            onClick={addNewTicket}
          >
            <span className={styles['add-another-ticket-text']}>Add another ticketing option?</span >
            <span class="material-symbols-outlined">
              add
            </span>
          </div>
        </span>
        <div style={{ width: '50%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', }}>
          <span>
            <div className={styles.title} style={{ marginBottom: 0, fontWeight: 700 }}>
              Select ticketing options
            </div>
            <MTBSelector
              onBlur={() => ("name")}
              name={"name"}
              placeholder='Type'
              value={tickets[ticketSelectedIndex].option}
              itemName={"name"}
              itemValue={"name"}
              options={ticketingOptions}
              onChange={(selected, fieldName) => {
                changeTicketSelectedAttr('option', selected);
              }}
              styles={{
                display: 'flex',
                background: '#FCFCFC',
                borderRadius: '10px',
                boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702',
                boxShadow: '0px 4.679279327392578px 4.679279327392578px 0px #00000014',
                width: '40%',
                height: '18px',
              }}
            />
          </span>
          <span>
            <div style={{ marginBottom: '10px', marginTop: '10px' }}>
              Type of ticket
            </div>
            <div className={styles.inputContainer} style={{ width: '100%', padding: '5px 10px' }}>
              <input
                className={styles.input}
                type="text"
                value={tickets[ticketSelectedIndex].type}
                placeholder="Type your ‘Type of ticket’"
                onBlur={() => {}}
                onChange={(e) => changeTicketSelectedAttr('type',e.target.value)}
              />
            </div>
            {tickets[ticketSelectedIndex]?.option === 'External link' && (
              <div>
                <div className={styles.title} style={{ marginBottom: '7px', fontWeight: 700 }}>
                  Add external links
                </div>
                <div className={styles.inputContainer} style={{ width: '100%', marginBottom: '10px', padding: '5px 10px' }}>
                  <input
                    className={styles.input}
                    type="text"
                    value={tickets[ticketSelectedIndex].link1 || ''}
                    placeholder="Link 1"
                    onBlur={() => {}}
                    onChange={(e) => changeTicketSelectedAttr('link1',e.target.value)}
                  />
                </div>
                <div className={styles.inputContainer} style={{ width: '100%', marginBottom: '10px', padding: '5px 10px' }}>
                  <input
                    className={styles.input}
                    type="text"
                    value={tickets[ticketSelectedIndex].link2 || ''}
                    placeholder="Link 2"
                    onBlur={() => {}}
                    onChange={(e) => changeTicketSelectedAttr('link2',e.target.value)}
                  />
                </div>
                <div className={styles.inputContainer} style={{ width: '100%', padding: '5px 10px' }}>
                  <input
                    className={styles.input}
                    type="text"
                    value={tickets[ticketSelectedIndex].link3 || ''}
                    placeholder="Link 3"
                    onBlur={() => {}}
                    onChange={(e) => changeTicketSelectedAttr('link3',e.target.value)}
                  />
                </div>
              </div>
            )}
            {(tickets[ticketSelectedIndex]?.option === 'Free' || tickets[ticketSelectedIndex].option === 'RSVP') && (
              <div>
                <span style={{ width: '100%' }}>
                  <div className={styles.title} style={{ fontWeight: 700, marginBottom: 0,marginTop: '15px' }}>
                    Add additional information
                  </div>
                  <div className={styles.inputContainer} style={{ width: '100%', marginBottom: '10px', padding: '5px 10px' }}>
                    <textarea
                      className={styles.input}
                      style={{ width: '100%', height: '80px', resize: 'none' }}
                      cols="20" rows="1"
                      value={tickets[ticketSelectedIndex].description || ''}
                      placeholder="Type your additional information..."
                      onBlur={() => {}}
                      onChange={(e) => changeTicketSelectedAttr('description',e.target.value)}
                    />
                  </div>
                </span>
              </div>
            )}
          </span>
        </div>
      </div>
      {showNext && (
        <button
          className={createMultipleClasses([styles.baseButton, styles.createEventButton])}
          style={{ marginTop: '0px' }}
          onClick={() => _handleContinue()}
        >
          Next
        </button>
      )}
    </div>
 )
};

export default MTBTicketsEditor;

